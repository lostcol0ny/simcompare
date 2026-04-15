#!/usr/bin/env node
/**
 * Fetches SimulationCraft's trait_data.inc and extracts the authoritative
 * talent node ID lists for each WoW class. Output is written to
 * src/data/simc-slot-maps.json as a Record<string, number[]> mapping
 * SimC class ID → sorted node ID array.
 *
 * Run: node scripts/generate-simc-nodes.mjs
 *
 * The slot map algorithm mirrors SimC's generate_tree_nodes():
 *   for each tree type (INVALID, CLASS, SPEC, HERO, SELECTION):
 *     add all trait nodes for the class to a map keyed by id_node
 *   → sort that map's keys ascending
 * Which simplifies to: all id_node values for the class, deduplicated, sorted ascending.
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SIMC_URL =
  'https://raw.githubusercontent.com/simulationcraft/simc/midnight/engine/dbc/generated/trait_data.inc'

// trait_data_t field layout (from trait_data.hpp):
//   tree_index, id_class, id_trait_node_entry, id_node, max_ranks, req_points,
//   id_trait_definition, id_spell, id_replace_spell, id_override_spell,
//   row, col, selection_index, name, id_spec[4], id_spec_starter[4],
//   id_sub_tree, node_type
//
// tree_index values: INVALID=0, CLASS=1, SPECIALIZATION=2, HERO=3, SELECTION=4
//
// For the slot map we need all nodes by class (fields 1=id_class, 3=id_node).
// For hero tree membership we also need tree_index and id_sub_tree (second-to-last field).
// We parse full records for the hero tree data.
const FAST_PATTERN = /\{\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,/g

// Full record pattern — captures tree_index(1), id_class(2), id_node(3),
// selection_index(4), id_sub_tree(5), node_type(6).
// Used for hero tree extraction (tree_index=3) AND selection node extraction (node_type=3).
const FULL_PATTERN = /\{\s*(\d+)\s*,\s*(\d+)\s*,\s*\d+\s*,\s*(\d+)\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*-?\d+\s*,\s*-?\d+\s*,\s*(-?\d+)\s*,\s*"[^"]*"\s*,\s*\{\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\}\s*,\s*\{\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\}\s*,\s*(\d+)\s*,\s*(\d+)\s*\}/g

async function main() {
  console.log('Fetching trait_data.inc from SimC repository…')
  const res = await fetch(SIMC_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${SIMC_URL}`)
  const text = await res.text()
  console.log(`Fetched ${(text.length / 1024).toFixed(0)} KB`)

  // Pass 1: fast scan for slot maps (all node IDs per class)
  /** @type {Map<number, Set<number>>} classId → set of all node IDs */
  const classMaps = new Map()

  let m
  let total = 0
  FAST_PATTERN.lastIndex = 0
  while ((m = FAST_PATTERN.exec(text)) !== null) {
    const classId = parseInt(m[2], 10)
    const nodeId  = parseInt(m[4], 10)
    if (classId === 0 || classId > 13 || nodeId === 0) continue
    if (!classMaps.has(classId)) classMaps.set(classId, new Set())
    classMaps.get(classId).add(nodeId)
    total++
  }
  console.log(`Slot map pass: ${total} trait entries across ${classMaps.size} classes`)

  // Pass 2: full parse for hero tree membership AND selection nodes.
  // heroByClass: classId → Map<subTreeId, Set<nodeId>>
  // selectionByClass: classId → Map<nodeId, Map<selectionIndex, subTreeId>>
  /** @type {Map<number, Map<number, Set<number>>>} */
  const heroByClass = new Map()
  /** @type {Map<number, Map<number, Map<number, number>>>} */
  const selectionByClass = new Map()

  let heroTotal = 0
  let selectionTotal = 0
  FULL_PATTERN.lastIndex = 0
  while ((m = FULL_PATTERN.exec(text)) !== null) {
    const treeIndex     = parseInt(m[1], 10)
    const classId       = parseInt(m[2], 10)
    const nodeId        = parseInt(m[3], 10)
    const selectionIndex = parseInt(m[4], 10)
    const subTreeId     = parseInt(m[5], 10)
    const nodeType      = parseInt(m[6], 10)
    if (classId === 0 || classId > 13 || nodeId === 0) continue

    // Hero tree nodes (tree_index=3 means HERO tree type)
    if (treeIndex === 3 && subTreeId !== 0) {
      if (!heroByClass.has(classId)) heroByClass.set(classId, new Map())
      const treeMap = heroByClass.get(classId)
      if (!treeMap.has(subTreeId)) treeMap.set(subTreeId, new Set())
      treeMap.get(subTreeId).add(nodeId)
      heroTotal++
    }

    // Selection nodes (node_type=3 means sub_tree_selection)
    if (nodeType === 3 && subTreeId !== 0) {
      if (!selectionByClass.has(classId)) selectionByClass.set(classId, new Map())
      const nodeMap = selectionByClass.get(classId)
      if (!nodeMap.has(nodeId)) nodeMap.set(nodeId, new Map())
      nodeMap.get(nodeId).set(selectionIndex, subTreeId)
      selectionTotal++
    }
  }
  console.log(`Hero tree pass: ${heroTotal} hero entries`)
  console.log(`Selection node pass: ${selectionTotal} selection entries`)

  // Build output
  const slotMaps = /** @type {Record<string, number[]>} */ ({})
  const heroTrees = /** @type {Record<string, Record<string, number[]>>} */ ({})
  const selectionNodes = /** @type {Record<string, Record<string, Record<string, number>>>} */ ({})

  for (const [classId, nodeSet] of [...classMaps.entries()].sort((a, b) => a[0] - b[0])) {
    const key = String(classId)
    slotMaps[key] = [...nodeSet].sort((a, b) => a - b)
    console.log(`  class ${classId}: ${slotMaps[key].length} slot nodes`)

    const treeMap = heroByClass.get(classId)
    if (treeMap) {
      heroTrees[key] = {}
      for (const [subTreeId, nodeSet2] of [...treeMap.entries()].sort((a, b) => a[0] - b[0])) {
        heroTrees[key][String(subTreeId)] = [...nodeSet2].sort((a, b) => a - b)
      }
      console.log(`    hero sub-trees: ${Object.keys(heroTrees[key]).join(', ')} (${Object.values(heroTrees[key]).map(n => n.length).join('/')} nodes)`)
    }

    const selMap = selectionByClass.get(classId)
    if (selMap) {
      selectionNodes[key] = {}
      for (const [nodeId, choiceMap] of [...selMap.entries()].sort((a, b) => a[0] - b[0])) {
        // Convert raw selection_index (100, 200, …) to 0-based choiceIndex
        // by sorting entries by selection_index and using ordinal position.
        // This matches how the talent string encoder stores choiceIndex.
        const sorted = [...choiceMap.entries()].sort((a, b) => a[0] - b[0])
        selectionNodes[key][String(nodeId)] = {}
        sorted.forEach(([, subTreeId], i) => {
          selectionNodes[key][String(nodeId)][String(i)] = subTreeId
        })
      }
      const count = Object.keys(selectionNodes[key]).length
      console.log(`    selection nodes: ${count} (${Object.entries(selectionNodes[key]).map(([nid, m]) => `${nid}→[${Object.entries(m).map(([i, s]) => `${i}:${s}`).join(',')}]`).join(', ')})`)
    }
  }

  const output = { slotMaps, heroTrees, selectionNodes }
  const outPath = join(__dirname, '..', 'src', 'data', 'simc-slot-maps.json')
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n')
  console.log(`\nWrote ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
