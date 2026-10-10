/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A starting index for the metabolome.
 *
 * HMDB holds roughly a quarter of a million entries, which is not something a
 * search box alone lets you explore — you have to already know what you want.
 * This is a hand-picked set of well-characterised human metabolites, grouped so
 * there is always something to click.
 *
 * Entries are NAMES, not accessions, and deliberately so: the name is resolved
 * live against HMDB (falling back to PubChem's cross-reference) when you click
 * it, so the accession, and every value shown afterwards, comes from the
 * database rather than from this file. A name that no longer resolves reports a
 * clean "not found" instead of opening the wrong record.
 *
 * The grouping is an editorial convenience for navigation. It is not HMDB's own
 * taxonomy — each record shows HMDB's classification once it loads.
 */

export interface BrowseCategory {
  key: string;
  label: string;
  blurb: string;
  members: string[];
}

export const BROWSE_CATEGORIES: BrowseCategory[] = [
  {
    key: "energy",
    label: "Energy & carbohydrates",
    blurb: "Glycolysis, the TCA cycle, and the sugars that feed them.",
    members: [
      "Glucose", "Fructose", "Galactose", "Mannose", "Sucrose", "Lactose",
      "Pyruvic acid", "Lactic acid", "Citric acid", "Succinic acid",
      "Fumaric acid", "Malic acid", "Oxaloacetic acid", "Glucose 6-phosphate",
      "Ribose", "Glycerol",
    ],
  },
  {
    key: "amino",
    label: "Amino acids",
    blurb: "The proteinogenic twenty, plus urea-cycle and sulfur-pathway members.",
    members: [
      "Alanine", "Arginine", "Asparagine", "Aspartic acid", "Cysteine",
      "Glutamic acid", "Glutamine", "Glycine", "Histidine", "Isoleucine",
      "Leucine", "Lysine", "Methionine", "Phenylalanine", "Proline", "Serine",
      "Threonine", "Tryptophan", "Tyrosine", "Valine", "Ornithine", "Citrulline",
    ],
  },
  {
    key: "neuro",
    label: "Neurotransmitters & their metabolites",
    blurb: "Monoamines and the urinary metabolites used to track them.",
    members: [
      "Dopamine", "Serotonin", "Norepinephrine", "Epinephrine", "Acetylcholine",
      "Histamine", "L-DOPA", "Homovanillic acid", "5-Hydroxyindoleacetic acid",
      "Vanillylmandelic acid", "Normetanephrine", "Metanephrine", "Adenosine",
      "Tryptamine",
    ],
  },
  {
    key: "lipids",
    label: "Lipids & steroids",
    blurb: "Fatty acids, sterols, bile acids, and the steroid hormones.",
    members: [
      "Cholesterol", "Palmitic acid", "Oleic acid", "Stearic acid",
      "Linoleic acid", "Arachidonic acid", "Docosahexaenoic acid",
      "Eicosapentaenoic acid", "Cortisol", "Testosterone", "Estradiol",
      "Progesterone", "Aldosterone", "Cholic acid", "Sphingosine", "Carnitine",
    ],
  },
  {
    key: "nucleotides",
    label: "Nucleotides & purines",
    blurb: "Bases, nucleosides, energy carriers, and the purine-breakdown route.",
    members: [
      "Adenine", "Guanine", "Cytosine", "Thymine", "Uracil", "Guanosine",
      "Inosine", "Hypoxanthine", "Xanthine", "Uric acid", "Adenosine triphosphate",
      "Adenosine monophosphate", "Orotic acid",
    ],
  },
  {
    key: "vitamins",
    label: "Vitamins & cofactors",
    blurb: "Water- and fat-soluble vitamins and the cofactors derived from them.",
    members: [
      "Thiamine", "Riboflavin", "Niacin", "Nicotinamide", "Pantothenic acid",
      "Pyridoxine", "Biotin", "Folic acid", "Cobalamin", "Ascorbic acid",
      "Retinol", "Alpha-Tocopherol", "Choline", "Betaine",
      "S-Adenosylmethionine", "Coenzyme Q10",
    ],
  },
  {
    key: "clinical",
    label: "Clinical & metabolic markers",
    blurb: "Analytes that turn up on panels, in ketosis, and in inborn errors.",
    members: [
      "Urea", "Creatinine", "Creatine", "Ammonia", "Oxalic acid",
      "Acetoacetic acid", "3-Hydroxybutyric acid", "Acetone",
      "Methylmalonic acid", "Phenylpyruvic acid", "Hippuric acid", "Cystine",
      "Bilirubin", "Propionic acid",
    ],
  },
  {
    key: "neuroeye",
    label: "Neurology & ophthalmology",
    blurb: "Metabolites that recur in neurodegeneration, retinal biology and diabetic eye disease.",
    members: [
      "Taurine", "Glutathione", "Homocysteine", "Melatonin",
      "gamma-Aminobutyric acid", "Kynurenine", "Quinolinic acid",
      "N-Acetylaspartic acid", "Myo-inositol", "Sorbitol", "Galactitol",
      "Retinal", "Retinoic acid",
    ],
  },
  {
    key: "xeno",
    label: "Drugs & xenobiotics",
    blurb: "Compounds the body processes but does not make.",
    members: [
      "Caffeine", "Theobromine", "Theophylline", "Nicotine", "Cotinine",
      "Ethanol", "Acetaminophen", "Salicylic acid", "Ibuprofen", "Metformin",
      "Warfarin", "Morphine", "Codeine",
    ],
  },
];

/** Every name in the index, de-duplicated and sorted. */
export const ALL_BROWSE_NAMES: string[] = [
  ...new Set(BROWSE_CATEGORIES.flatMap((c) => c.members)),
].sort((a, b) => a.localeCompare(b));

/** A name picked at random, for when you just want somewhere to start. */
export function randomMetaboliteName(rng: () => number = Math.random): string {
  return ALL_BROWSE_NAMES[Math.floor(rng() * ALL_BROWSE_NAMES.length)];
}
