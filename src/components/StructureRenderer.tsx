/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { parseSmiles } from "../lib/chemEngine";
import { Atom, RotateCcw, Eye, Layers } from "lucide-react";

interface StructureRendererProps {
  smiles: string;
  width?: number;
  height?: number;
}

interface Node3D {
  id: number;
  symbol: string;
  isAromatic: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

interface Link {
  source: number;
  target: number;
  order: number; // 1 = single, 2 = double, 3 = triple, 1.5 = aromatic
}

export default function StructureRenderer({
  smiles,
  width = 500,
  height = 360,
}: StructureRendererProps) {
  // State for rendering options
  const [viewMode, setViewMode] = useState<"ballAndStick" | "spaceFilling" | "skeletal">("ballAndStick");
  const [showHydrogens, setShowHydrogens] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(0.9);

  // 3D coordinates system state
  const [nodes, setNodes] = useState<Node3D[]>([]);
  const [links, setLinks] = useState<Link[]>([]);

  // Camera angles (in radians)
  const [rotX, setRotX] = useState<number>(-0.35); // Slight tilt to establish 3D perspective
  const [rotY, setRotY] = useState<number>(0.45);

  // Drag interaction state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-rotate ticker using standard requestAnimationFrame
  useEffect(() => {
    if (!autoRotate || isDragging) return;

    let frameId: number;
    const tick = () => {
      setRotY((prev) => (prev + 0.006) % (Math.PI * 2));
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [autoRotate, isDragging]);

  // Parse SMILES and solve coordinates using a high-fidelity 3D Spring Layout solver
  useEffect(() => {
    if (!smiles) return;
    try {
      const graph = parseSmiles(smiles);
      const initialNodes: Node3D[] = [];
      const initialLinks: Link[] = [];

      // 1. Map heavy atoms from the SMILES graph
      graph.atoms.forEach((atom) => {
        initialNodes.push({
          id: atom.id,
          symbol: atom.symbol,
          isAromatic: atom.isAromatic,
          x: 0,
          y: 0,
          z: 0,
          vx: 0,
          vy: 0,
          vz: 0,
        });
      });

      // Map heavy bonds
      graph.bonds.forEach((bond) => {
        initialLinks.push({
          source: bond.atom1,
          target: bond.atom2,
          order: bond.order,
        });
      });

      // 2. Expand graph to include virtual Hydrogen atoms is showHydrogens is active
      if (showHydrogens) {
        graph.atoms.forEach((atom) => {
          const numH = atom.implicitHydrogens;
          if (numH > 0) {
            for (let h = 0; h < numH; h++) {
              const hId = 2000 + atom.id * 10 + h;
              // Add virtual hydrogren node
              initialNodes.push({
                id: hId,
                symbol: "H",
                isAromatic: false,
                x: 0,
                y: 0,
                z: 0,
                vx: 0,
                vy: 0,
                vz: 0,
              });
              // Bond it to the parent heavy atom
              initialLinks.push({
                source: atom.id,
                target: hId,
                order: 1, // Hydrogen is always single-bonded
              });
            }
          }
        });
      }

      // Initialize positions in a helical 3D distribution to avoid overlaps and resolve Z coordinates instantly
      const totalCount = initialNodes.length;
      initialNodes.forEach((node, idx) => {
        const phi = Math.acos(-1 + (2 * idx) / totalCount);
        const theta = Math.sqrt(totalCount * Math.PI) * phi;
        const radius = 60 + Math.random() * 15;

        node.x = radius * Math.sin(phi) * Math.cos(theta);
        node.y = radius * Math.cos(phi);
        node.z = radius * Math.sin(phi) * Math.sin(theta);
      });

      // Run 3D Physical Constraint relaxation (3D spring layout solver)
      const iterations = 180;
      const k = 42; // Perfect spring rest length
      const cRepulse = 1800; // Atoms repulsion multiplier
      const cAttract = 0.082; // Chemical bonds attraction multiplier
      const damping = 0.82;

      for (let step = 0; step < iterations; step++) {
        // A. Repulsion between all atomic pairs in 3D
        for (let i = 0; i < initialNodes.length; i++) {
          for (let j = i + 1; j < initialNodes.length; j++) {
            const n1 = initialNodes[i];
            const n2 = initialNodes[j];
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const dz = n2.z - n1.z;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1.0;
            
            // Adjust repulsion range: Hydrogen repels less
            const repulsionRange = (n1.symbol === "H" || n2.symbol === "H") ? 90 : 160;
            if (d < repulsionRange) {
              const force = cRepulse / (d * d);
              const fx = (dx / d) * force;
              const fy = (dy / d) * force;
              const fz = (dz / d) * force;
              n1.vx -= fx;
              n1.vy -= fy;
              n1.vz -= fz;
              n2.vx += fx;
              n2.vy += fy;
              n2.vz += fz;
            }
          }
        }

        // B. Attraction along bond constraints in 3D
        for (const link of initialLinks) {
          const n1 = initialNodes.find((n) => n.id === link.source);
          const n2 = initialNodes.find((n) => n.id === link.target);
          if (!n1 || !n2) continue;

          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dz = n2.z - n1.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1.0;

          // H-bonds have shorter standard bond lengths (approx 25)
          const targetLength = (n1.symbol === "H" || n2.symbol === "H") ? 28 : k;
          const force = cAttract * (d - targetLength);
          const fx = (dx / d) * force;
          const fy = (dy / d) * force;
          const fz = (dz / d) * force;

          n1.vx += fx;
          n1.vy += fy;
          n1.vz += fz;
          n2.vx -= fx;
          n2.vy -= fy;
          n2.vz -= fz;
        }

        // C. Gravity pull to keep centration during physics relaxation
        for (const n of initialNodes) {
          const dx = -n.x;
          const dy = -n.y;
          const dz = -n.z;
          n.vx += dx * 0.015;
          n.vy += dy * 0.015;
          n.vz += dz * 0.015;

          // Apply velocity mechanics
          n.x += n.vx;
          n.y += n.vy;
          n.z += n.vz;
          n.vx *= damping;
          n.vy *= damping;
          n.vz *= damping;
        }
      }

      // Perfect alignment: Center coordinates perfectly to origin (0,0,0)
      let sumX = 0, sumY = 0, sumZ = 0;
      initialNodes.forEach((n) => {
        sumX += n.x;
        sumY += n.y;
        sumZ += n.z;
      });
      const avgX = sumX / initialNodes.length;
      const avgY = sumY / initialNodes.length;
      const avgZ = sumZ / initialNodes.length;

      initialNodes.forEach((n) => {
        n.x -= avgX;
        n.y -= avgY;
        n.z -= avgZ;
      });

      setNodes(initialNodes);
      setLinks(initialLinks);
    } catch (e) {
      console.error("Unable to draw 3D structure: ", e);
    }
  }, [smiles, showHydrogens]);

  // Handle active interactive dragging inside the 3D orbital space
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - lastMousePos.current.x;
    const deltaY = e.clientY - lastMousePos.current.y;

    setRotY((prev) => (prev + deltaX * 0.01) % (Math.PI * 2));
    setRotX((prev) => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, prev + deltaY * 0.01)));

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Mobile Touch support for 3D rotation
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - lastMousePos.current.x;
    const deltaY = e.touches[0].clientY - lastMousePos.current.y;

    setRotY((prev) => (prev + deltaX * 0.01) % (Math.PI * 2));
    setRotX((prev) => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, prev + deltaY * 0.01)));

    lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  // CPK Physical radius parameters matching relative elemental volumes
  const getAtomRadius = (sym: string): number => {
    if (viewMode === "spaceFilling") {
      switch (sym.toUpperCase()) {
        case "C": return 22;
        case "H": return 15;
        case "O": return 20;
        case "N": return 21;
        case "F": return 19;
        case "CL": return 24;
        case "BR": return 26;
        case "S": return 23;
        case "P": return 23;
        default: return 20;
      }
    } else {
      // Standard Ball and stick sizes
      switch (sym.toUpperCase()) {
        case "C": return 11.5;
        case "H": return 7.5; // Hydrogens are beautiful small cute balls
        case "O": return 11.0;
        case "N": return 11.5;
        case "F": return 10.0;
        case "CL": return 13.0;
        case "BR": return 14.0;
        case "S": return 12.5;
        case "P": return 12.5;
        default: return 11.0;
      }
    }
  };

  // Standard official CPK visual gradient tags targeting
  const getAtomGradientId = (sym: string): string => {
    const s = sym.toUpperCase();
    if (["C", "H", "O", "N", "F", "CL", "BR", "S", "P"].includes(s)) {
      return `sphere-${s}`;
    }
    return "sphere-default";
  };

  // Standard non-gradient solid CPK hex colors fallback
  const getAtomColorHex = (sym: string): string => {
    switch (sym.toUpperCase()) {
      case "O": return "#EF4444";
      case "N": return "#3B82F6";
      case "C": return "#2D3139";
      case "H": return "#64748B";
      default: return "#475569";
    }
  };

  // Perform orthographic camera projection and coordinate rotation around X and Y axes
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);

  const center2D = { x: width / 2, y: (height - 50) / 2 };

  // Generate rotated states for Z-sorting
  const projectedNodes = nodes.map((node) => {
    // Rotation around Y-axis (Yaw)
    const x1 = node.x * cosY - node.z * sinY;
    const z1 = node.x * sinY + node.z * cosY;

    // Rotation around X-axis (Pitch)
    const y2 = node.y * cosX - z1 * sinX;
    const z2 = node.y * sinX + z1 * cosX;

    // Perspective depth projection factor
    const scalar = zoom * (1 + z2 * 0.0016); // Subtle perspectivity depth
    const px = center2D.x + x1 * scalar;
    const py = center2D.y + y2 * scalar;

    return {
      ...node,
      px,
      py,
      pz: z2, // Store Z coordinate for depth ordering
    };
  });

  // Calculate standard molecular scale radius for lighting fog cues
  const maxZ = projectedNodes.reduce((acc, curr) => Math.max(acc, Math.abs(curr.pz)), 10) || 50;

  // Let's bundle ALL entities (atoms & bonds) into a single Z-sorted paint list
  const renderList: Array<
    | {
        type: "atom";
        id: number;
        z: number;
        symbol: string;
        px: number;
        py: number;
        radius: number;
        gradientId: string;
      }
    | {
        type: "bond";
        key: string;
        z: number;
        p1: { x: number; y: number };
        p2: { x: number; y: number };
        order: number;
        sourceSym: string;
        targetSym: string;
      }
  > = [];

  // Add bonds to list
  links.forEach((link, idx) => {
    const n1 = projectedNodes.find((n) => n.id === link.source);
    const n2 = projectedNodes.find((n) => n.id === link.target);
    if (!n1 || !n2) return;

    // Depth is the average Z coordinate of the connected atoms
    const avgZ = (n1.pz + n2.pz) / 2;

    renderList.push({
      type: "bond",
      key: `b-${idx}-${link.source}-${link.target}`,
      z: avgZ - 1, // Slightly pull back bonds to draw them seamlessly connected
      p1: { x: n1.px, y: n1.py },
      p2: { x: n2.px, y: n2.py },
      order: link.order,
      sourceSym: n1.symbol,
      targetSym: n2.symbol,
    });
  });

  // Add atoms to list (unless in skeletal and we prefer not to draw carbon spheres)
  projectedNodes.forEach((node) => {
    const sizeRadius = getAtomRadius(node.symbol);
    
    // Scale radius slightly by dynamic camera depth
    const depthScale = 1.0 + (node.pz / maxZ) * 0.15;
    const projectedRadius = Math.max(2, sizeRadius * zoom * depthScale);

    renderList.push({
      type: "atom",
      id: node.id,
      z: node.pz,
      symbol: node.symbol,
      px: node.px,
      py: node.py,
      radius: projectedRadius,
      gradientId: getAtomGradientId(node.symbol),
    });
  });

  // Sort back-to-front (lowest Z is further away, highest Z is closer to camera)
  renderList.sort((a, b) => a.z - b.z);

  const resetView = () => {
    setRotX(-0.35);
    setRotY(0.45);
    setZoom(0.9);
  };

  return (
    <div className="relative border border-slate-200/80 rounded-xl bg-slate-900 overflow-hidden flex flex-col items-center justify-center p-0 w-full select-none" style={{ minHeight: `${height}px` }} id="molecule-3d-panel">
      {/* Absolute futuristic technical grid & ambient glows */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black pointer-events-none" />
      <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />

      {/* Primary SVG interactive workspace container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUpOrLeave}
        className="w-full relative z-10 flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        <svg
          width={width}
          height={height - 50}
          className="select-none overflow-visible"
        >
          <defs>
            {/* Soft sphere layout drop shadow */}
            <filter id="soft-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="1" dy="3.5" stdDeviation="3" floodColor="#000000" floodOpacity="0.75" />
            </filter>

            {/* CPK Gradients Definitions for Photorealistic 3D Material Balls */}
            {/* Carbon (Black/Smoke) */}
            <radialGradient id="sphere-C" cx="33%" cy="33%" r="66%" fx="33%" fy="33%">
              <stop offset="0%" stopColor="#8E9AA6" />
              <stop offset="38%" stopColor="#2A2F35" />
              <stop offset="85%" stopColor="#14171A" />
              <stop offset="100%" stopColor="#08080A" />
            </radialGradient>

            {/* Hydrogen (Snow White/Alabaster) */}
            <radialGradient id="sphere-H" cx="33%" cy="33%" r="66%" fx="33%" fy="33%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="42%" stopColor="#E2E8F0" />
              <stop offset="85%" stopColor="#A8B4C2" />
              <stop offset="100%" stopColor="#788594" />
            </radialGradient>

            {/* Oxygen (Glossy Crimson Red) */}
            <radialGradient id="sphere-O" cx="33%" cy="33%" r="66%" fx="33%" fy="33%">
              <stop offset="0%" stopColor="#FF8B8B" />
              <stop offset="32%" stopColor="#E63946" />
              <stop offset="80%" stopColor="#8C1320" />
              <stop offset="100%" stopColor="#450005" />
            </radialGradient>

            {/* Nitrogen (Vibrant Electric Blue) */}
            <radialGradient id="sphere-N" cx="33%" cy="33%" r="66%" fx="33%" fy="33%">
              <stop offset="0%" stopColor="#9ECAFF" />
              <stop offset="30%" stopColor="#2563EB" />
              <stop offset="80%" stopColor="#1E3A8A" />
              <stop offset="100%" stopColor="#0F172A" />
            </radialGradient>

            {/* Fluorine (Bright Emerald/Seafoam) */}
            <radialGradient id="sphere-F" cx="33%" cy="33%" r="66%" fx="33%" fy="33%">
              <stop offset="0%" stopColor="#A7F3D0" />
              <stop offset="32%" stopColor="#10B981" />
              <stop offset="80%" stopColor="#065F46" />
              <stop offset="100%" stopColor="#022C22" />
            </radialGradient>

            {/* Chlorine (Neon Lime Green) */}
            <radialGradient id="sphere-CL" cx="33%" cy="33%" r="66%" fx="33%" fy="33%">
              <stop offset="0%" stopColor="#BEF264" />
              <stop offset="30%" stopColor="#84CC16" />
              <stop offset="80%" stopColor="#3F6212" />
              <stop offset="100%" stopColor="#1A2E05" />
            </radialGradient>

            {/* Bromine (Dark Cocoa/Amber-Earth) */}
            <radialGradient id="sphere-BR" cx="33%" cy="33%" r="66%" fx="33%" fy="33%">
              <stop offset="0%" stopColor="#FFC794" />
              <stop offset="32%" stopColor="#B45309" />
              <stop offset="80%" stopColor="#78350F" />
              <stop offset="100%" stopColor="#451A03" />
            </radialGradient>

            {/* Sulfur (Sunshine Mustard Yellow) */}
            <radialGradient id="sphere-S" cx="33%" cy="33%" r="66%" fx="33%" fy="33%">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="30%" stopColor="#EAB308" />
              <stop offset="80%" stopColor="#854D0E" />
              <stop offset="100%" stopColor="#431407" />
            </radialGradient>

            {/* Phosphorus (Bright Purple Orchid) */}
            <radialGradient id="sphere-P" cx="33%" cy="33%" r="66%" fx="33%" fy="33%">
              <stop offset="0%" stopColor="#F5D0FE" />
              <stop offset="30%" stopColor="#C084FC" />
              <stop offset="80%" stopColor="#7E22CE" />
              <stop offset="100%" stopColor="#4C1D95" />
            </radialGradient>

            {/* Default fallback material */}
            <radialGradient id="sphere-default" cx="33%" cy="33%" r="66%" fx="33%" fy="33%">
              <stop offset="0%" stopColor="#F1F5F9" />
              <stop offset="40%" stopColor="#94A3B8" />
              <stop offset="80%" stopColor="#475569" />
              <stop offset="100%" stopColor="#1E293B" />
            </radialGradient>

            {/* Cylinder Rod Linear Shading Gradient */}
            <linearGradient id="stick-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#A1A1A1" opacity="0.9" />
              <stop offset="35%" stopColor="#6C6C6C" opacity="0.9" />
              <stop offset="70%" stopColor="#4A4A4A" opacity="0.9" />
              <stop offset="100%" stopColor="#2D2D2D" opacity="0.9" />
            </linearGradient>
          </defs>

          {/* Render painter's algorithm list */}
          {renderList.map((ent) => {
            const depthFactor = Math.max(0.35, Math.min(1.0, (ent.z / maxZ) * 0.35 + 0.82));

            if (ent.type === "bond") {
              const dx = ent.p2.x - ent.p1.x;
              const dy = ent.p2.y - ent.p1.y;
              const length = Math.sqrt(dx * dx + dy * dy) || 1.0;

              // Hide bonds in skeletal mode to draw lines instead
              const isSkeletal = viewMode === "skeletal";
              const cylinderWidth = isSkeletal ? 2.0 : (viewMode === "spaceFilling" ? 5 : 7) * zoom * depthFactor;

              // For double/triple bonds, we offset orthogonal paths
              const ox = -dy / length;
              const oy = dx / length;

              // Parallel bonds spacing based on view mode
              const doubleOffset = isSkeletal ? 1.8 * zoom : 3.0 * zoom;
              const tripleOffset = isSkeletal ? 3.0 * zoom : 4.4 * zoom;

              const strokeStyle = isSkeletal ? getAtomColorHex(ent.targetSym) : "url(#stick-gradient)";

              // Double Bonds rendering (Skeletal or Ball and Stick)
              if (ent.order === 2) {
                const strokeW = isSkeletal ? 1.6 : cylinderWidth * 0.7;
                return (
                  <g key={ent.key} className="pointer-events-none opacity-90">
                    <line
                      x1={ent.p1.x + ox * doubleOffset}
                      y1={ent.p1.y + oy * doubleOffset}
                      x2={ent.p2.x + ox * doubleOffset}
                      y2={ent.p2.y + oy * doubleOffset}
                      stroke={strokeStyle}
                      strokeWidth={strokeW}
                      strokeLinecap="round"
                    />
                    <line
                      x1={ent.p1.x - ox * doubleOffset}
                      y1={ent.p1.y - oy * doubleOffset}
                      x2={ent.p2.x - ox * doubleOffset}
                      y2={ent.p2.y - oy * doubleOffset}
                      stroke={strokeStyle}
                      strokeWidth={strokeW}
                      strokeLinecap="round"
                    />
                  </g>
                );
              }

              // Triple Bonds rendering (Skeletal or Ball and Stick)
              if (ent.order === 3) {
                const strokeCenter = isSkeletal ? 1.6 : cylinderWidth * 0.6;
                const strokeSide = isSkeletal ? 1.2 : cylinderWidth * 0.52;
                return (
                  <g key={ent.key} className="pointer-events-none opacity-90">
                    <line
                      x1={ent.p1.x}
                      y1={ent.p1.y}
                      x2={ent.p2.x}
                      y2={ent.p2.y}
                      stroke={strokeStyle}
                      strokeWidth={strokeCenter}
                      strokeLinecap="round"
                    />
                    <line
                      x1={ent.p1.x + ox * tripleOffset}
                      y1={ent.p1.y + oy * tripleOffset}
                      x2={ent.p2.x + ox * tripleOffset}
                      y2={ent.p2.y + oy * tripleOffset}
                      stroke={strokeStyle}
                      strokeWidth={strokeSide}
                      strokeLinecap="round"
                    />
                    <line
                      x1={ent.p1.x - ox * tripleOffset}
                      y1={ent.p1.y - oy * tripleOffset}
                      x2={ent.p2.x - ox * tripleOffset}
                      y2={ent.p2.y - oy * tripleOffset}
                      stroke={strokeStyle}
                      strokeWidth={strokeSide}
                      strokeLinecap="round"
                    />
                  </g>
                );
              }

              // Standard bond (single, aromatic)
              const strokeDash = ent.order === 1.5 ? "3,3" : undefined;
              const bondStroke = isSkeletal ? getAtomColorHex(ent.targetSym) : "url(#stick-gradient)";

              return (
                <line
                  key={ent.key}
                  x1={ent.p1.x}
                  y1={ent.p1.y}
                  x2={ent.p2.x}
                  y2={ent.p2.y}
                  stroke={bondStroke}
                  strokeWidth={cylinderWidth}
                  strokeDasharray={strokeDash}
                  strokeLinecap="round"
                  className="pointer-events-none"
                  style={{ opacity: depthFactor }}
                />
              );
            } else {
              // Atom rendering
              const isCarbon = ent.symbol === "C";
              const isSkeletal = viewMode === "skeletal";

              if (isSkeletal && isCarbon) {
                // Carbon node is just a very small and clean structural vertex intersection point in skeletal view
                return (
                  <circle
                     key={`a-${ent.id}`}
                     cx={ent.px}
                     cy={ent.py}
                     r={1.2}
                     fill="#64748B"
                     opacity={depthFactor * 0.9}
                     className="pointer-events-none"
                  />
                );
              }

              return (
                <g
                  key={`a-${ent.id}`}
                  transform={`translate(${ent.px},${ent.py})`}
                  className="pointer-events-none group"
                  style={{ opacity: depthFactor }}
                >
                  <circle
                    r={ent.radius}
                    fill={`url(#${ent.gradientId})`}
                    filter="url(#soft-shadow)"
                  />
                  
                  {/* Symbol overlay on top of sphere if ballAndStick or skeletal */}
                  {(!isCarbon || isSkeletal) && ent.symbol !== "H" && ent.radius > 7 && (
                    <text
                      textAnchor="middle"
                      dy="3.5"
                      fontSize={Math.max(8, ent.radius * 0.72)}
                      fontWeight="bold"
                      fill={ent.symbol === "H" ? "#334155" : "#FFFFFF"}
                      stroke="#000000"
                      strokeWidth={0.15}
                      className="font-mono pointer-events-none"
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
                    >
                      {ent.symbol}
                    </text>
                  )}
                </g>
              );
            }
          })}
        </svg>
      </div>

      {/* Futuristic 3D control bar panel at bottom */}
      <div className="absolute bottom-0 inset-x-0 h-14 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 flex items-center justify-between px-4 z-20 text-xs text-slate-300 select-none">
        
        {/* Style selection */}
        <div className="flex gap-1.5 items-center">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-0.5 flex gap-1 font-mono">
            <button
              onClick={() => setViewMode("ballAndStick")}
              className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition ${
                viewMode === "ballAndStick" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Ball-Stick
            </button>
            <button
              onClick={() => setViewMode("spaceFilling")}
              className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition ${
                viewMode === "spaceFilling" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              VdW-Sphere
            </button>
            <button
              onClick={() => setViewMode("skeletal")}
              className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition ${
                viewMode === "skeletal" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Skeletal
            </button>
          </div>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-slate-400">ZOOM:</span>
          <input
            type="range"
            min="0.5"
            max="1.6"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        {/* Dynamic configuration options */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[10px] text-slate-350 select-none">
            <input
              type="checkbox"
              checked={showHydrogens}
              onChange={(e) => setShowHydrogens(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer h-3.5 w-3.5"
            />
            <span>SHOW H</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[10px] text-slate-350 select-none">
            <input
              type="checkbox"
              checked={autoRotate}
              onChange={(e) => setAutoRotate(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer h-3.5 w-3.5"
            />
            <span>SPIN 3D</span>
          </label>

          <button
            onClick={resetView}
            title="Reset Camera Position"
            className="p-1 px-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 hover:text-white transition flex items-center gap-1 text-[10px] font-mono tracking-wider text-slate-400"
          >
            <RotateCcw className="w-3 h-3" />
            <span>RESET</span>
          </button>
        </div>

      </div>

      {/* Floating 3D status badge */}
      <div className="absolute top-3.5 left-3 px-2.5 py-1 pointer-events-none select-none font-mono text-[9px] font-semibold text-slate-300 bg-black/50 backdrop-blur-sm rounded-lg border border-slate-800/80 flex items-center gap-1.5 z-20">
        <Atom className="w-3 h-3 text-blue-400 animate-spin" style={{ animationDuration: "3s" }} />
        <span>3D BALL-AND-STICK ORBITAL</span>
      </div>
      
    </div>
  );
}
