/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Live PubChem (PUG-REST) client. Always routes to PubChem — there is no offline
 * data path. Resolves name / SMILES / CID, with autocomplete fuzzy matching.
 */

// Current PubChem PUG-REST property names. (PubChem renamed the SMILES fields in
// 2025: CanonicalSMILES -> ConnectivitySMILES, IsomericSMILES -> SMILES. Requesting
// a retired name makes PUG-REST reject the whole request with HTTP 400.)
const PUBCHEM_PROPS = "MolecularFormula,MolecularWeight,IUPACName,SMILES,ConnectivitySMILES,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,RotatableBondCount";

/**
 * Resolve a query to a PubChem CID via the /cids endpoint. This carries no
 * property names, so compound existence is decided independently of the property
 * schema. 404/400 = no such compound / unparseable query (null); other non-OK
 * statuses are reachability problems (throw).
 */
async function pubchemResolveCid(kind: "name" | "smiles", value: string): Promise<number | null> {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/${kind}/${encodeURIComponent(value)}/cids/JSON`;
  const r = await fetch(url);
  if (r.status === 404 || r.status === 400) return null;
  if (!r.ok) throw new Error(`PubChem returned HTTP ${r.status}`);
  const data: any = await r.json();
  const cid = data?.IdentifierList?.CID?.[0];
  return typeof cid === "number" ? cid : null;
}

/** Fetch a compound's properties by CID. Non-fatal: returns {} on any problem so a
 * property hiccup never turns a real compound into a "not found". */
async function pubchemPropertiesByCid(cid: number): Promise<any> {
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/${PUBCHEM_PROPS}/JSON`;
    const r = await fetch(url);
    if (!r.ok) return {};
    const data: any = await r.json();
    return data?.PropertyTable?.Properties?.[0] || {};
  } catch {
    return {};
  }
}

/** Ask PubChem's autocomplete for the closest real compound name to a fuzzy/misspelled query. */
async function pubchemSuggestName(q: string): Promise<string | null> {
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${encodeURIComponent(q)}/json?limit=1`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data: any = await r.json();
    return data?.dictionary_terms?.compound?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Resolve any chemical against the live PubChem database (name, SMILES, CID, or a
 * fuzzy/misspelled name via autocomplete). Returns null when PubChem is reachable
 * but has no such compound; throws when PubChem itself cannot be reached.
 */
export async function fetchPubChemData(q: string) {
  const trimmed = q.trim();
  if (!trimmed) return null;

  try {
    const hasSpace = /\s/.test(trimmed);
    const isCid = /^[0-9]+$/.test(trimmed);
    // Treat as SMILES only when it carries SMILES-specific syntax and no spaces,
    // so chemical names with parentheses (e.g. "iron(III) chloride") still search by name.
    const looksSmiles = !hasSpace && !isCid && /[=#\[\]]/.test(trimmed) && /[A-Za-z]/.test(trimmed);

    let cid: number | null = null;
    let resolvedQuery = trimmed;

    if (isCid) {
      cid = Number(trimmed);
    } else if (looksSmiles) {
      cid = await pubchemResolveCid("smiles", trimmed);
    } else {
      cid = await pubchemResolveCid("name", trimmed);
      if (!cid) {
        // Fuzzy resolve: correct spelling / partial name to the nearest real compound and retry.
        const suggestion = await pubchemSuggestName(trimmed);
        if (suggestion && suggestion.toLowerCase() !== trimmed.toLowerCase()) {
          const retryCid = await pubchemResolveCid("name", suggestion);
          if (retryCid) {
            cid = retryCid;
            resolvedQuery = suggestion;
          }
        }
      }
    }

    // Reaching this point means PubChem responded. No CID is a genuine "no such compound".
    if (!cid) {
      console.warn(`PubChem has no compound matching "${trimmed}".`);
      return null;
    }

    const properties = await pubchemPropertiesByCid(cid);
    // A user-typed CID that doesn't resolve to a real compound yields no properties.
    if (isCid && !properties.MolecularFormula && !properties.SMILES && !properties.ConnectivitySMILES) {
      console.warn(`PubChem CID ${trimmed} did not resolve to a compound.`);
      return null;
    }

    // Fetch Description
    let description = "No description available in PubChem.";
    let descriptionSource = "";
    let descriptionUrl = "";
    try {
      const descResponse = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/description/JSON`);
      if (descResponse.ok) {
        const descData: any = await descResponse.json();
        const infoList = descData?.InformationList?.Information || [];
        const found = infoList.find((info: any) => info.Description);
        if (found) {
          description = found.Description;
          descriptionSource = found.DescriptionSourceName || "";
          descriptionUrl = found.DescriptionSourceURL || "";
        }
      }
    } catch (e) {
      console.error("Failed to fetch description: ", e);
    }

    // Fetch Synonyms
    let synonyms: string[] = [];
    try {
      const synResponse = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/synonyms/JSON`);
      if (synResponse.ok) {
        const synData: any = await synResponse.json();
        synonyms = synData?.InformationList?.Information?.[0]?.Synonym?.slice(0, 10) || [];
      }
    } catch (e) {
      console.error("Failed to fetch synonyms: ", e);
    }

    const commonName = synonyms?.[0] || resolvedQuery.charAt(0).toUpperCase() + resolvedQuery.slice(1);

    return {
      cid,
      name: commonName,
      iupac_name: properties.IUPACName || resolvedQuery,
      smiles: properties.SMILES || properties.ConnectivitySMILES || "",
      formula: properties.MolecularFormula,
      mw: properties.MolecularWeight,
      clogp: properties.XLogP !== undefined ? properties.XLogP : null,
      tpsa: properties.TPSA !== undefined ? properties.TPSA : null,
      hbd: properties.HBondDonorCount !== undefined ? properties.HBondDonorCount : null,
      hba: properties.HBondAcceptorCount !== undefined ? properties.HBondAcceptorCount : null,
      rotatable_bonds: properties.RotatableBondCount !== undefined ? properties.RotatableBondCount : null,
      description,
      descriptionSource,
      descriptionUrl,
      synonyms,
      reportUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
      websiteReportEmbed: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Top`,
    };
  } catch (err) {
    // Transport failure — PubChem itself could not be reached. Report it honestly.
    const errorPrefix = err instanceof Error ? err.message : String(err);
    console.log(`[PubChem Fetch] PubChem unreachable for "${trimmed}". Reason: ${errorPrefix.slice(0, 120)}`);
    throw new Error(`PubChem is currently unreachable, so "${trimmed}" could not be looked up. Check the server's network connection to pubchem.ncbi.nlm.nih.gov and try again.`);
  }
}
