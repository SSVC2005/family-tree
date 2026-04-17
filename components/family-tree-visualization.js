"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Heart,
  Baby,
  Users,
  Trash2,
  AlertTriangle,
  UserCheck,
  Save,
  Search,
  Settings,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Lock,
  Edit,
  Unlink,
  Maximize2,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import EditMemberDialog from "@/components/edit-member-dialog"

// ───────────────────────────────────────────────────────────
//  LAYOUT CONSTANTS
// ───────────────────────────────────────────────────────────
const CARD_W = 160
const CARD_H = 200
const SPOUSE_GAP = 50
const SIBLING_GAP = 44
const GENERATION_GAP = 110
const CONNECTOR_DROP = 18
const CORNER_RADIUS = 8

// ───────────────────────────────────────────────────────────
//  LAYOUT ENGINE
// ───────────────────────────────────────────────────────────

/**
 * Compute the width of a "couple unit" (person + optional spouse).
 */
function coupleWidth(person) {
  if (person.spouse) return CARD_W + SPOUSE_GAP + CARD_W
  return CARD_W
}

/**
 * Recursively compute the full subtree width for a person, bottom-up.
 * This ensures siblings never overlap because each node claims width ≥ its children span.
 */
function subtreeWidth(person, visited = new Set()) {
  if (!person || visited.has(person.id)) return CARD_W
  visited.add(person.id)

  const cw = coupleWidth(person)
  
  const childrenSet = new Map()
  if (person.children) {
    person.children.forEach(c => childrenSet.set(c.id, c))
  }
  if (person.spouse && person.spouse.children) {
    person.spouse.children.forEach(c => childrenSet.set(c.id, c))
  }
  const children = Array.from(childrenSet.values())

  if (children.length === 0) return cw

  let childrenSpan = 0
  for (let i = 0; i < children.length; i++) {
    if (i > 0) childrenSpan += SIBLING_GAP
    childrenSpan += subtreeWidth(children[i], new Set(visited))
  }

  return Math.max(cw, childrenSpan)
}

/**
 * Compute the full ancestor height above a person (how many generations up).
 */
function ancestorDepth(person, visited = new Set()) {
  if (!person || visited.has(person.id)) return 0
  visited.add(person.id)

  const parents = person.parents || []
  if (parents.length === 0) return 0

  let maxDepth = 0
  for (const p of parents) {
    maxDepth = Math.max(maxDepth, 1 + ancestorDepth(p, new Set(visited)))
  }
  return maxDepth
}

/**
 * Compute the required width for an ancestor's subtree to prevent overlap.
 */
function ancestorWidth(person, visited = new Set()) {
  if (!person || visited.has(person.id)) return CARD_W
  visited.add(person.id)
  
  const parents = person.parents || []
  let parentsSpan = CARD_W
  if (parents.length > 0) {
    let span = 0
    for (let i = 0; i < parents.length; i++) {
      if (i > 0) span += SPOUSE_GAP
      span += ancestorWidth(parents[i], new Set(visited))
    }
    parentsSpan = Math.max(CARD_W, span)
  }

  let siblingsSpan = 0
  if (parents.length > 0 && parents[0].children) {
    for (const sib of parents[0].children) {
      if (sib.id === person.id) continue
      siblingsSpan += subtreeWidth(sib, new Set(visited)) + SIBLING_GAP
    }
  }
  
  return Math.max(CARD_W, parentsSpan) + siblingsSpan
}

/**
 * Compute the full ancestor height above the spouse too.
 */
function totalAncestorDepth(person) {
  let d = ancestorDepth(person)
  if (person.spouse) {
    d = Math.max(d, ancestorDepth(person.spouse))
  }
  return d
}

/**
 * Main layout function. Returns { positions, connectors, bounds }.
 * positions: Map<personId, { x, y, w, h }>
 * connectors: Array<{ type, points }>
 * bounds: { minX, minY, maxX, maxY }
 */
function computeLayout(rootPerson, allMembersMap) {
  if (!rootPerson || !allMembersMap) return { positions: new Map(), connectors: [], bounds: { minX: 0, minY: 0, maxX: 400, maxY: 400 } }

  const positions = new Map()
  const connectors = []

  // Determine the root row Y: leave room for ancestors above.
  const ancDepth = totalAncestorDepth(rootPerson)
  const rootY = ancDepth * (CARD_H + GENERATION_GAP)

  // ─── Place descendants (root + children + grandchildren …) ───

  function placeDescendants(person, cx, y, visited) {
    if (!person || visited.has(person.id)) return
    visited.add(person.id)

    const cw = coupleWidth(person)

    // The coupled center: person card left edge is at cx - cw/2
    const personX = cx - cw / 2
    positions.set(person.id, { x: personX, y, w: CARD_W, h: CARD_H })

    if (person.spouse && !visited.has(person.spouse.id)) {
      visited.add(person.spouse.id)
      const spouseX = personX + CARD_W + SPOUSE_GAP
      positions.set(person.spouse.id, { x: spouseX, y, w: CARD_W, h: CARD_H })

      connectors.push({
        type: "spouse",
        x1: personX + CARD_W,
        y1: y + CARD_H / 2,
        x2: spouseX,
        y2: y + CARD_H / 2,
      })
    }

    const childrenSet = new Map()
    if (person.children) {
      person.children.forEach(c => childrenSet.set(c.id, c))
    }
    if (person.spouse && person.spouse.children) {
      person.spouse.children.forEach(c => childrenSet.set(c.id, c))
    }
    const children = Array.from(childrenSet.values())
    
    if (children.length === 0) return

    const childY = y + CARD_H + GENERATION_GAP

    // Compute each child's subtree width
    const childWidths = children.map((c) => subtreeWidth(c, new Set(visited)))
    const totalChildrenWidth = childWidths.reduce((a, b) => a + b, 0) + (children.length - 1) * SIBLING_GAP

    // Children start from the left, centered under cx
    let childStartX = cx - totalChildrenWidth / 2

    const coupleDropStartY = person.spouse ? y + CARD_H / 2 : y + CARD_H
    const coupleBottomY = y + CARD_H
    const childCenterXs = []

    for (let i = 0; i < children.length; i++) {
      const childCW = childWidths[i]
      const childCX = childStartX + childCW / 2
      
      const childCardCenterX = childCX - coupleWidth(children[i]) / 2 + CARD_W / 2
      childCenterXs.push(childCardCenterX)

      placeDescendants(children[i], childCX, childY, visited)
      childStartX += childCW + SIBLING_GAP
    }

    connectors.push({
      type: "parent-children",
      parentCenterX: cx,
      parentBottomY: coupleBottomY,
      parentDropStartY: coupleDropStartY,
      childTopY: childY,
      childCenterXs,
    })
  }

  const rootVisited = new Set()
  
  const focusGeneration = [rootPerson]
  if (rootPerson.parents && rootPerson.parents.length > 0) {
    const parentNode = allMembersMap.get(rootPerson.parents[0].id)
    if (parentNode && parentNode.childIds) {
      parentNode.childIds.forEach((cid) => {
        if (cid !== rootPerson.id) {
          const s = allMembersMap.get(cid)
          if (s && !focusGeneration.find((fg) => fg.id === cid)) {
            // Find in parents children array to have full nested object
            const fullSibling = rootPerson.parents[0].children?.find(c => c.id === cid)
            if (fullSibling) {
              focusGeneration.push(fullSibling)
            } else {
              focusGeneration.push({ ...s, children: [], parents: [] })
            }
          }
        }
      })
    }
  }

  focusGeneration.sort((a,b) => {
     const da = a.dob ? new Date(a.dob).getTime() : Number.MAX_SAFE_INTEGER
     const db = b.dob ? new Date(b.dob).getTime() : Number.MAX_SAFE_INTEGER
     return da - db
  })

  const focusWidths = focusGeneration.map(p => subtreeWidth(p, new Set()))
  const totalFocusWidth = focusWidths.reduce((a,b) => a+b, 0) + (focusGeneration.length - 1) * SIBLING_GAP
  
  let currentStartX = -totalFocusWidth / 2
  let rootPersonCX = 0
  
  for (let i = 0; i < focusGeneration.length; i++) {
    const p = focusGeneration[i]
    const w = focusWidths[i]
    const cx = currentStartX + w / 2
    if (p.id === rootPerson.id) rootPersonCX = cx
    
    placeDescendants(p, cx, rootY, rootVisited)
    currentStartX += w + SIBLING_GAP
  }

  // Compute root bounds to prevent ancestor siblings from overlapping
  const rootLeftBound = currentStartX - totalFocusWidth - SIBLING_GAP
  const rootRightBound = currentStartX

  // ─── Place ancestors (parents, grandparents …) above ───

  function placeAncestors(person, visited, childCenterXTarget, descendantLeft = null, descendantRight = null, wallLeft = null, wallRight = null, siblingSide = "left") {
    if (!person) return

    const pos = positions.get(person.id)
    if (!pos) return

    const parents = person.parents || []
    if (parents.length === 0) return

    const parentY = pos.y - CARD_H - GENERATION_GAP

    const siblings = (parents[0].children || []).filter(c => c.id !== person.id)
    
    let currXLeft = pos.x - SIBLING_GAP - CARD_W
    if (descendantLeft !== null && siblingSide === "left") {
      currXLeft = Math.min(currXLeft, descendantLeft - SIBLING_GAP - CARD_W)
    }

    let currXRight = pos.x + CARD_W + SIBLING_GAP
    if (descendantRight !== null && siblingSide === "right") {
      currXRight = Math.max(currXRight, descendantRight + SIBLING_GAP)
    }

    const childCenterXs = [pos.x + CARD_W / 2]

    for (const sib of siblings) {
      if (positions.has(sib.id)) {
        childCenterXs.push(positions.get(sib.id).x + CARD_W / 2)
      } else if (!visited.has(sib.id)) {
        const sw = subtreeWidth(sib, new Set(visited))
        let cx = 0
        if (siblingSide === "left") {
          cx = currXLeft - sw / 2
          currXLeft -= (sw + SIBLING_GAP)
        } else {
          cx = currXRight + sw / 2
          currXRight += (sw + SIBLING_GAP)
        }
        
        placeDescendants(sib, cx, pos.y, visited)
        
        const placedPos = positions.get(sib.id)
        if (placedPos) {
          childCenterXs.push(placedPos.x + CARD_W / 2)
        }
      }
    }

    const nextDescLeft = siblingSide === "left" ? currXLeft : Math.min(pos.x, descendantLeft !== null ? descendantLeft : pos.x)
    const nextDescRight = siblingSide === "right" ? currXRight : Math.max(pos.x + CARD_W, descendantRight !== null ? descendantRight : pos.x + CARD_W)

    if (parents.length === 1) {
      const parent = parents[0]
      if (visited.has(parent.id)) return
      visited.add(parent.id)
      
      const groupCenterX = childCenterXs.reduce((a,b)=>a+b,0) / childCenterXs.length
      let parentX = (childCenterXTarget !== null ? childCenterXTarget : groupCenterX) - CARD_W / 2
      
      const parentWidth = ancestorWidth(parent)
      const requiredXLeft = wallLeft !== null ? wallLeft + SIBLING_GAP + parentWidth - CARD_W : -Infinity
      const requiredXRight = wallRight !== null ? wallRight - SIBLING_GAP - parentWidth : Infinity
      
      if (parentX < requiredXLeft) {
        parentX = requiredXLeft
      }
      if (parentX > requiredXRight) {
        parentX = requiredXRight
      }

      positions.set(parent.id, { x: parentX, y: parentY, w: CARD_W, h: CARD_H })

      connectors.push({
        type: "parent-children",
        parentCenterX: parentX + CARD_W / 2,
        parentBottomY: parentY + CARD_H,
        parentDropStartY: parentY + CARD_H,
        childTopY: pos.y,
        childCenterXs: childCenterXs,
      })

      placeAncestors(parent, visited, null, nextDescLeft, nextDescRight, wallLeft, wallRight, siblingSide)
    } else if (parents.length >= 2) {
      const p1 = parents[0]
      const p2 = parents[1]
      
      const groupCenterX = childCenterXs.reduce((a,b)=>a+b,0) / childCenterXs.length
      const layoutRefX = childCenterXTarget !== null ? childCenterXTarget : groupCenterX

      let p1x = layoutRefX - SPOUSE_GAP / 2 - CARD_W
      let p2x = layoutRefX + SPOUSE_GAP / 2

      const p1Width = ancestorWidth(p1)
      const p2Width = ancestorWidth(p2)

      const requiredP1x = wallLeft !== null ? wallLeft + SIBLING_GAP + p1Width - CARD_W : -Infinity
      const requiredP2x = wallRight !== null ? wallRight - SIBLING_GAP - p2Width : Infinity

      if (p1x < requiredP1x) {
        const shift = requiredP1x - p1x
        p1x += shift
        p2x += shift
      }
      if (p2x > requiredP2x) {
        const shift = p2x - requiredP2x
        p1x -= shift
        p2x -= shift
      }

      if (!visited.has(p1.id)) {
        visited.add(p1.id)
        positions.set(p1.id, { x: p1x, y: parentY, w: CARD_W, h: CARD_H })
      }
      if (!visited.has(p2.id)) {
        visited.add(p2.id)
        positions.set(p2.id, { x: p2x, y: parentY, w: CARD_W, h: CARD_H })
      }

      connectors.push({
        type: "spouse",
        x1: p1x + CARD_W,
        y1: parentY + CARD_H / 2,
        x2: p2x,
        y2: parentY + CARD_H / 2,
      })

      const parentCoupleCenterX = (p1x + CARD_W / 2 + p2x + CARD_W / 2) / 2
      
      // Offset railY slightly based on centerX to prevent horizontal rails from exactly overlapping
      const railOffset = (Math.abs(Math.round(parentCoupleCenterX)) % 15)
      
      connectors.push({
        type: "parent-children",
        parentCenterX: parentCoupleCenterX,
        parentBottomY: parentY + CARD_H,
        parentDropStartY: parentY + CARD_H / 2,
        childTopY: pos.y,
        childCenterXs: childCenterXs,
        railOffset: railOffset,
      })

      placeAncestors(p1, visited, null, nextDescLeft, null, wallLeft, null, "left")
      placeAncestors(p2, visited, null, null, nextDescRight, null, wallRight, "right")
    }
  }

  placeAncestors(rootPerson, new Set(), rootPersonCX, rootLeftBound, rootRightBound, null, null)

  if (rootPerson.spouse) {
    const spcx = positions.get(rootPerson.spouse.id)?.x ? positions.get(rootPerson.spouse.id).x + CARD_W / 2 : rootPersonCX + CARD_W + SPOUSE_GAP
    
    let currentMaxX = -Infinity
    for (const p of positions.values()) {
      currentMaxX = Math.max(currentMaxX, p.x + p.w)
    }

    placeAncestors(rootPerson.spouse, new Set([rootPerson.id]), spcx, null, null, currentMaxX, null, "right")
  }

  // ─── Place siblings (shown via allMembers lookup) ───
  // Siblings are already in the tree as children of the same parents,
  // so they're already placed by placeDescendants when viewing from parent root.
  // When the root person has siblings that share parents, they appear
  // as fellow children of those parents via the ancestor layout.

  // ─── Compute bounds ───
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of positions.values()) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x + p.w)
    maxY = Math.max(maxY, p.y + p.h)
  }

  if (!isFinite(minX)) {
    minX = 0; minY = 0; maxX = 400; maxY = 400
  }

  // ─── Place unvisited members (Aunts, Uncles, etc.) below the tree ───
  const unvisitedMembers = Array.from(allMembersMap.values()).filter(m => !positions.has(m.id))
  if (unvisitedMembers.length > 0) {
    let orphanX = minX
    let orphanY = maxY + CARD_H * 2
    
    for (const orphan of unvisitedMembers) {
      positions.set(orphan.id, { x: orphanX, y: orphanY, w: CARD_W, h: CARD_H })
      maxX = Math.max(maxX, orphanX + CARD_W)
      maxY = Math.max(maxY, orphanY + CARD_H)
      
      orphanX += CARD_W + SIBLING_GAP
      if (orphanX > minX + 1200) {
        orphanX = minX
        orphanY += CARD_H + GENERATION_GAP
      }
    }
  }

  // Add padding
  const PAD = 100
  minX -= PAD; minY -= PAD; maxX += PAD; maxY += PAD

  return { positions, connectors, bounds: { minX, minY, maxX, maxY } }
}

// ───────────────────────────────────────────────────────────
//  SVG CONNECTOR RENDERER
// ───────────────────────────────────────────────────────────

function buildConnectorPaths(connectors) {
  const paths = []
  const r = CORNER_RADIUS

  for (const c of connectors) {
    if (c.type === "spouse") {
      // Simple horizontal line with a heart symbol at midpoint
      const midX = (c.x1 + c.x2) / 2
      paths.push({
        d: `M ${c.x1} ${c.y1} L ${c.x2} ${c.y2}`,
        stroke: "#e11d48",
        strokeWidth: 2,
        strokeDasharray: "6,4",
        key: `spouse-${c.x1}-${c.y1}`,
      })
      // Small heart at midpoint
      paths.push({
        heart: true,
        cx: midX,
        cy: c.y1,
        key: `heart-${c.x1}-${c.y1}`,
      })
    } else if (c.type === "parent-children") {
      const { parentCenterX, parentBottomY, childTopY, childCenterXs, parentDropStartY, railOffset } = c
      const railY = parentBottomY + CONNECTOR_DROP + (railOffset || 0)
      const startY = parentDropStartY ?? parentBottomY

      // Vertical drop from parent to rail
      paths.push({
        d: `M ${parentCenterX} ${startY} L ${parentCenterX} ${railY}`,
        stroke: "#475569",
        strokeWidth: 2,
        key: `pcdrop-${parentCenterX}-${startY}`,
      })

      const leftmost = Math.min(...childCenterXs, parentCenterX)
      const rightmost = Math.max(...childCenterXs, parentCenterX)

      // Horizontal rail
      if (leftmost !== rightmost) {
        paths.push({
          d: `M ${leftmost} ${railY} L ${rightmost} ${railY}`,
          stroke: "#475569",
          strokeWidth: 2,
          key: `pcrail-${parentCenterX}-${railY}`,
        })
      }

      // Vertical drops from rail to each child
      for (const cx of childCenterXs) {
        paths.push({
          d: `M ${cx} ${railY} L ${cx} ${childTopY}`,
          stroke: "#475569",
          strokeWidth: 2,
          key: `pcchild-${cx}-${childTopY}-${startY}`,
        })
      }
    } else if (c.type === "ancestor") {
      const { childCenterX, childTopY, parentCenterXs, parentBottomY, parentDropStartY } = c
      const railY = childTopY - CONNECTOR_DROP
      const startY = parentDropStartY ?? parentBottomY

      // Vertical line from child top up to rail
      paths.push({
        d: `M ${childCenterX} ${childTopY} L ${childCenterX} ${railY}`,
        stroke: "#475569",
        strokeWidth: 2,
        key: `ancdrop-${childCenterX}-${childTopY}`,
      })

      for (const pcx of parentCenterXs) {
        // Line from rail up to parent bottom
        if (pcx === childCenterX) {
          paths.push({
            d: `M ${pcx} ${railY} L ${pcx} ${startY}`,
            stroke: "#475569",
            strokeWidth: 2,
            key: `ancline-${pcx}-${startY}`,
          })
        } else {
          // Horizontal then vertical with rounded corners
          paths.push({
            d: `M ${childCenterX} ${railY} L ${pcx} ${railY} L ${pcx} ${startY}`,
            stroke: "#475569",
            strokeWidth: 2,
            key: `ancline-${pcx}-${startY}`,
          })
        }
      }
    }
  }

  return paths
}

// ───────────────────────────────────────────────────────────
//  COMPONENT
// ───────────────────────────────────────────────────────────

export default function FamilyTreeVisualization({
  tree,
  onAddMember,
  onMemberDeleted,
  treeId,
  onSetRootPerson,
  permissions: incomingPermissions,
}) {
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [focusPerson, setFocusPerson] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [showPersonDetails, setShowPersonDetails] = useState(false)
  const [showEditMember, setShowEditMember] = useState(false)
  const [editingPerson, setEditingPerson] = useState(null)

  // Pan & Zoom state
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [panOrigin, setPanOrigin] = useState({ x: 0, y: 0 })

  const canvasRef = useRef(null)
  const contentRef = useRef(null)

  const permissions = incomingPermissions || { canView: true, canEdit: false, isOwner: false }

  const allMembersMap = useMemo(() => {
    const m = new Map()
    if (Array.isArray(tree?.allMembers)) tree.allMembers.forEach((mb) => m.set(mb.id, mb))
    return m
  }, [tree?.allMembers])

  // ─── Compute layout whenever tree changes ───
  const { positions, connectors, bounds, pathData } = useMemo(() => {
    const layout = computeLayout(tree?.rootPerson, allMembersMap)
    return { ...layout, pathData: buildConnectorPaths(layout.connectors) }
  }, [tree?.rootPerson, allMembersMap])

  // Keep a ref to current positions so centerOnPerson is always fresh
  const positionsRef = useRef(positions)
  useEffect(() => { positionsRef.current = positions }, [positions])

  const centerOnPerson = useCallback((personId) => {
    if (!canvasRef.current) return
    const pos = positionsRef.current.get(personId)
    if (!pos) return
    const rect = canvasRef.current.getBoundingClientRect()
    const targetZoom = 0.85
    const centerX = pos.x + pos.w / 2
    const centerY = pos.y + pos.h / 2
    setPan({
      x: rect.width / 2 - centerX * targetZoom,
      y: rect.height / 2 - centerY * targetZoom,
    })
    setZoom(targetZoom)
  }, [])

  // ─── Center view on root person whenever root changes ───
  const prevRootId = useRef(null)
  useEffect(() => {
    if (!tree?.rootPerson) return
    if (tree.rootPerson.id !== prevRootId.current) {
      prevRootId.current = tree.rootPerson.id
      // Defer until layout positions are rendered
      const t = setTimeout(() => centerOnPerson(tree.rootPerson.id), 50)
      return () => clearTimeout(t)
    }
  }, [tree?.rootPerson?.id, centerOnPerson])

  // ─── Mouse handlers for panning ───
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return // left click only
    // Don't pan if clicking on interactive elements
    if (e.target.closest("button, input, [role='dialog'], .card-interactive")) return
    setIsPanning(true)
    setPanStart({ x: e.clientX, y: e.clientY })
    setPanOrigin({ ...pan })
    e.preventDefault()
  }, [pan])

  const handleMouseMove = useCallback((e) => {
    if (!isPanning) return
    const dx = e.clientX - panStart.x
    const dy = e.clientY - panStart.y
    setPan({
      x: panOrigin.x + dx,
      y: panOrigin.y + dy,
    })
  }, [isPanning, panStart, panOrigin])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // ─── Scroll wheel for zoom (centered on cursor) ───
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.1), 3.0)

    // Adjust pan so zoom centers on cursor
    const scale = newZoom / zoom
    setPan({
      x: mouseX - scale * (mouseX - pan.x),
      y: mouseY - scale * (mouseY - pan.y),
    })
    setZoom(newZoom)
  }, [zoom, pan])

  // Attach wheel listener with passive: false
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener("wheel", handleWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", handleWheel)
  }, [handleWheel])

  // ─── Touch handlers for mobile pan/pinch ───
  const touchRef = useRef({ lastDist: 0, lastCenter: { x: 0, y: 0 } })

  const handleTouchStart = useCallback((e) => {
    if (e.target.closest("button, input, [role='dialog'], .card-interactive")) return
    if (e.touches.length === 1) {
      setIsPanning(true)
      setPanStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
      setPanOrigin({ ...pan })
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      touchRef.current.lastDist = Math.sqrt(dx * dx + dy * dy)
      touchRef.current.lastCenter = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      }
    }
  }, [pan])

  const handleTouchMove = useCallback((e) => {
    if (e.target.closest("button, input, [role='dialog'], .card-interactive")) return
    e.preventDefault()
    if (e.touches.length === 1 && isPanning) {
      const dx = e.touches[0].clientX - panStart.x
      const dy = e.touches[0].clientY - panStart.y
      setPan({ x: panOrigin.x + dx, y: panOrigin.y + dy })
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const center = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      }

      if (touchRef.current.lastDist > 0) {
        const scaleFactor = dist / touchRef.current.lastDist
        const newZoom = Math.min(Math.max(zoom * scaleFactor, 0.1), 3.0)

        const canvas = canvasRef.current
        if (canvas) {
          const rect = canvas.getBoundingClientRect()
          const cx = center.x - rect.left
          const cy = center.y - rect.top
          const s = newZoom / zoom
          setPan({
            x: cx - s * (cx - pan.x),
            y: cy - s * (cy - pan.y),
          })
          setZoom(newZoom)
        }
      }

      touchRef.current.lastDist = dist
      touchRef.current.lastCenter = center
    }
  }, [isPanning, panStart, panOrigin, zoom, pan])

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false)
    touchRef.current.lastDist = 0
  }, [])

  // ─── Actions ───

  const handleDeleteMember = async (memberId) => {
    if (!permissions.canEdit) {
      alert("You don't have permission to edit this tree")
      return
    }
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`/api/family-trees/${treeId}/delete-member?memberId=${memberId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        onMemberDeleted()
        setSelectedPerson(null)
      } else {
        const data = await response.json()
        alert(data.message || "Failed to delete member")
      }
    } catch (error) {
      alert("An error occurred while deleting the member")
    }
  }

  const handleSearch = (term) => {
    setSearchTerm(term)
    if (!term.trim()) { setSearchResults([]); return }
    const lowered = term.toLowerCase()
    const sourceMembers = Array.isArray(tree.allMembers) ? tree.allMembers : []
    const results = sourceMembers
      .filter((member) => {
        const fullName = `${member.firstName || ""} ${member.lastName || ""}`.toLowerCase()
        const birth = member.dob || ""
        return fullName.includes(lowered) || birth.includes(lowered)
      })
      .slice(0, 50)
      .map((person) => ({ person }))
    setSearchResults(results)
  }

  const handleFocusPerson = (person) => {
    setFocusPerson(person)
    setSelectedPerson(person)
    centerOnPerson(person.id)
  }

  const handleSetRootPerson = (person) => {
    if (!person?.id || !onSetRootPerson) return
    onSetRootPerson(person.id)
    setShowSearch(false)
    setSelectedPerson(null)
    setFocusPerson(null)
    hasInitialized.current = false
  }

  const handleDivorce = async (person) => {
    if (!permissions.canEdit) { alert("You don't have permission to edit this tree"); return }
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`/api/family-trees/${treeId}/edit-member`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memberId: person.id, action: "divorceCurrentSpouse" }),
      })
      const data = await response.json()
      if (!response.ok) { alert(data.message || "Failed to divorce spouses"); return }
      onMemberDeleted()
      setSelectedPerson(null)
    } catch (error) {
      alert("An error occurred while divorcing spouses")
    }
  }

  const handleSaveTree = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`/api/family-trees/${treeId}/export`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${tree.lastName}-family-tree.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      alert("Failed to save tree")
    }
  }

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom * 1.2, 3.0)
    const canvas = canvasRef.current
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const cx = rect.width / 2
      const cy = rect.height / 2
      const s = newZoom / zoom
      setPan({ x: cx - s * (cx - pan.x), y: cy - s * (cy - pan.y) })
    }
    setZoom(newZoom)
  }

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom / 1.2, 0.1)
    const canvas = canvasRef.current
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const cx = rect.width / 2
      const cy = rect.height / 2
      const s = newZoom / zoom
      setPan({ x: cx - s * (cx - pan.x), y: cy - s * (cy - pan.y) })
    }
    setZoom(newZoom)
  }

  const handleResetView = () => {
    if (tree?.rootPerson) {
      centerOnPerson(tree.rootPerson.id)
    } else {
      setPan({ x: 0, y: 0 })
      setZoom(1)
    }
    setFocusPerson(null)
  }

  const handleFitAll = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const bw = bounds.maxX - bounds.minX
    const bh = bounds.maxY - bounds.minY
    if (bw <= 0 || bh <= 0) return
    const z = Math.min(rect.width / bw, rect.height / bh, 1.5) * 0.9
    setPan({
      x: rect.width / 2 - ((bounds.minX + bounds.maxX) / 2) * z,
      y: rect.height / 2 - ((bounds.minY + bounds.maxY) / 2) * z,
    })
    setZoom(z)
  }

  const handleEditMember = (person) => {
    if (!permissions.canEdit) { alert("You don't have permission to edit this tree"); return }
    setEditingPerson(person)
    setShowEditMember(true)
  }

  const handleMemberUpdated = () => {
    setShowEditMember(false)
    setEditingPerson(null)
    onMemberDeleted() // refreshes tree
  }

  // ─── Person Node Card ───

  const PersonNode = ({ person, pos }) => {
    if (!person || !pos) return null

    let ageDisplay = null
    const birthYear = person.dob ? new Date(person.dob).getFullYear() : null
    
    if (person.dob && !isNaN(birthYear)) {
      if (person.isDeceased && person.dateOfDeath) {
        const deathYear = new Date(person.dateOfDeath).getFullYear()
        ageDisplay = `b. ${birthYear} (d. ${deathYear})`
      } else if (person.isDeceased) {
        ageDisplay = `b. ${birthYear}`
      } else {
        const currentYear = new Date().getFullYear()
        const ageNum = currentYear - birthYear
        if (ageNum < 150 && ageNum >= 0) {
          ageDisplay = `Age ${ageNum} (b. ${birthYear})`
        } else {
          ageDisplay = `b. ${birthYear}`
        }
      }
    }

    const hasParents = person.parents && person.parents.length > 0
    const hasBothParents = person.parents && person.parents.length === 2
    const isDeceased = person.isDeceased || false
    const isSelected = selectedPerson?.id === person.id
    const isFocused = focusPerson?.id === person.id
    const isRoot = person.id === tree?.rootPerson?.id

    return (
      <div
        id={`person-${person.id}`}
        className="card-interactive absolute"
        style={{
          left: pos.x,
          top: pos.y,
          width: CARD_W,
        }}
      >
        <Card
          className={`cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 ${
            isDeceased
              ? "bg-gradient-to-b from-gray-50 to-gray-100 border-gray-400"
              : isRoot
              ? "bg-gradient-to-b from-amber-50 to-white border-amber-400 shadow-amber-100"
              : "bg-gradient-to-b from-white to-slate-50 border-slate-200"
          } ${isSelected ? "ring-2 ring-blue-500 shadow-blue-200 shadow-lg" : ""} ${
            isFocused ? "ring-4 ring-yellow-400 shadow-yellow-200 shadow-lg" : ""
          }`}
          onClick={() => setSelectedPerson(person)}
        >
          <CardContent className="p-3 flex flex-col items-center">
            {/* Avatar */}
            <div
              className={`w-14 h-14 rounded-full border-2 overflow-hidden mb-2 flex items-center justify-center ${
                isDeceased ? "bg-gray-300 border-gray-500" : isRoot ? "border-amber-400 bg-amber-100" : "bg-slate-200 border-slate-300"
              }`}
            >
              {person.photo ? (
                <img
                  src={person.photo || "/placeholder.svg"}
                  alt={`${person.firstName} ${person.lastName}`}
                  className={`w-full h-full object-cover ${isDeceased ? "grayscale" : ""}`}
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${isDeceased ? "bg-gray-400" : isRoot ? "bg-amber-200" : "bg-slate-300"}`}>
                  <svg className="w-7 h-7 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Name + Info */}
            <div className="text-center w-full">
              <h3 className={`font-semibold text-sm leading-tight truncate ${isDeceased ? "text-gray-600" : "text-gray-800"}`}>
                {person.firstName}
              </h3>
              <p className={`text-xs mt-0.5 truncate ${isDeceased ? "text-gray-500" : "text-gray-600"}`}>
                {person.lastName}
              </p>
              {ageDisplay && <p className="text-xs text-gray-400 mt-0.5">{ageDisplay}</p>}
              {isDeceased && person.dateOfDeath && !ageDisplay && (
                <p className="text-xs text-red-600 font-medium mt-0.5">
                  ✝ {new Date(person.dateOfDeath).getFullYear()}
                </p>
              )}
              {isDeceased && !person.dateOfDeath && !ageDisplay && (
                <p className="text-xs text-red-600 font-medium mt-0.5">
                  ✝ Deceased
                </p>
              )}
              {isRoot && (
                <Badge variant="outline" className="text-xs mt-1 border-amber-400 text-amber-700 bg-amber-50">
                  Root
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {permissions.canEdit && (
          <div className="flex flex-wrap justify-center gap-1 mt-1.5" style={{ maxWidth: CARD_W }}>
            <Button
              size="sm" variant="outline"
              className="h-5 px-1.5 text-[10px] bg-yellow-50 hover:bg-yellow-100 border-yellow-300"
              onClick={(e) => { e.stopPropagation(); handleEditMember(person) }}
              title="Edit Member"
            >
              <Edit className="h-2.5 w-2.5 mr-0.5" /> Edit
            </Button>
            <Button
              size="sm" variant="outline"
              className="h-5 px-1.5 text-[10px] bg-green-50 hover:bg-green-100 border-green-300"
              onClick={(e) => { e.stopPropagation(); onAddMember(person, "child") }}
              title="Add Child"
            >
              <Baby className="h-2.5 w-2.5 mr-0.5" /> Child
            </Button>
            {!person.spouse && (
              <Button
                size="sm" variant="outline"
                className="h-5 px-1.5 text-[10px] bg-pink-50 hover:bg-pink-100 border-pink-300"
                onClick={(e) => { e.stopPropagation(); onAddMember(person, "spouse") }}
                title="Add Spouse"
              >
                <Heart className="h-2.5 w-2.5 mr-0.5" /> Spouse
              </Button>
            )}
            <Button
              size="sm" variant="outline"
              className={`h-5 px-1.5 text-[10px] ${
                hasBothParents
                  ? "bg-gray-50 hover:bg-gray-100 border-gray-300 opacity-50"
                  : "bg-blue-50 hover:bg-blue-100 border-blue-300"
              }`}
              onClick={(e) => {
                e.stopPropagation()
                if (hasBothParents) { alert("This person already has both parents") }
                else { onAddMember(person, "parent") }
              }}
              title={hasBothParents ? "Already has both parents" : "Add Parents"}
            >
              <Users className="h-2.5 w-2.5 mr-0.5" /> Parents
            </Button>
            {hasParents && (
              <Button
                size="sm" variant="outline"
                className="h-5 px-1.5 text-[10px] bg-purple-50 hover:bg-purple-100 border-purple-300"
                onClick={(e) => { e.stopPropagation(); onAddMember(person, "sibling") }}
                title="Add Sibling"
              >
                <UserCheck className="h-2.5 w-2.5 mr-0.5" /> Sibling
              </Button>
            )}
          </div>
        )}

        {!permissions.canEdit && (
          <div className="mt-1 flex justify-center">
            <Badge variant="outline" className="text-[10px]">
              <Lock className="h-2.5 w-2.5 mr-0.5" /> Read Only
            </Badge>
          </div>
        )}
      </div>
    )
  }

  // ─── Render all person nodes at their layout positions ───
  const personNodes = []

  // Build full person objects by walking the tree structure
  function collectPersonsForRender(person, visited = new Set()) {
    if (!person || visited.has(person.id)) return
    visited.add(person.id)

    const pos = positions.get(person.id)
    if (pos) {
      personNodes.push(
        <PersonNode key={person.id} person={person} pos={pos} />
      )
    }

    if (person.spouse) collectPersonsForRender(person.spouse, visited)
    if (person.children) person.children.forEach((c) => collectPersonsForRender(c, visited))
    if (person.parents) person.parents.forEach((p) => collectPersonsForRender(p, visited))
  }

  if (tree?.rootPerson) {
    collectPersonsForRender(tree.rootPerson)
  }

  // Build SVG viewport to cover all content
  const svgMinX = bounds.minX - 50
  const svgMinY = bounds.minY - 50
  const svgW = bounds.maxX - bounds.minX + 100
  const svgH = bounds.maxY - bounds.minY + 100

  const countTotalMembers = () => {
    return Array.isArray(tree?.allMembers) ? tree.allMembers.length : 0
  }

  return (
    <div className="w-full">
      {/* Permission Alert */}
      {!permissions.canEdit && (
        <Alert className="mb-4 border-blue-200 bg-blue-50">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            <strong>Read-Only Access:</strong> {permissions.reason}. You can view this family tree but cannot make changes.
          </AlertDescription>
        </Alert>
      )}

      {/* Toolbar */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200 p-3 sticky top-0 z-20">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <Button onClick={handleSaveTree} size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
              <Save className="h-4 w-4 mr-1" /> Export
            </Button>
            <Button onClick={() => setShowSearch(!showSearch)} size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
              <Search className="h-4 w-4 mr-1" /> Search
            </Button>
            <Button onClick={() => setShowTools(!showTools)} size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
              <Settings className="h-4 w-4 mr-1" /> Tools
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Zoom controls inline */}
            <div className="flex items-center bg-gray-100 rounded-lg px-1 py-0.5 space-x-1">
              <Button onClick={handleZoomOut} variant="ghost" size="sm" className="h-7 w-7 p-0">
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-medium text-gray-600 min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
              <Button onClick={handleZoomIn} variant="ghost" size="sm" className="h-7 w-7 p-0">
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button onClick={handleFitAll} variant="ghost" size="sm" className="h-7 w-7 p-0" title="Fit all">
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              <Button onClick={handleResetView} variant="ghost" size="sm" className="h-7 w-7 p-0" title="Center root">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>

            {focusPerson && (
              <div className="flex items-center space-x-1 bg-yellow-100 px-2 py-1 rounded-lg text-xs">
                <span className="font-medium">
                  {focusPerson.firstName} {focusPerson.lastName}
                </span>
                <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setFocusPerson(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Search Panel */}
        {showSearch && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center space-x-3 mb-3">
              <Input
                placeholder="Search family members..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="flex-1"
              />
              <Button onClick={() => setShowSearch(false)} variant="outline" size="sm">
                Close
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 text-sm">Search Results:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                  {searchResults.map((result, index) => (
                    <Card key={index} className="p-2.5">
                      <div className="text-sm font-medium">{result.person.firstName} {result.person.lastName}</div>
                      <div className="text-xs text-gray-500 mb-2">
                        {result.person.dob ? new Date(result.person.dob).toLocaleDateString() : "Unknown DOB"}
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => handleFocusPerson(result.person)}>
                          Focus
                        </Button>
                        <Button size="sm" className="h-6 text-xs" onClick={() => handleSetRootPerson(result.person)}>
                          Set Root
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {searchTerm && searchResults.length === 0 && (
              <div className="text-gray-500 text-sm">No family members found matching "{searchTerm}"</div>
            )}
          </div>
        )}

        {/* Tools Panel */}
        {showTools && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Zoom: {Math.round(zoom * 100)}%</span>
              <span>Total Members: {countTotalMembers()}</span>
              <span>Access: {permissions.canEdit ? "Edit" : "Read-Only"}</span>
              <Button onClick={() => setShowTools(false)} variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Infinite Canvas ── */}
      <div
        ref={canvasRef}
        className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 select-none"
        style={{
          height: "calc(100vh - 180px)",
          cursor: isPanning ? "grabbing" : "grab",
          touchAction: "none",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Grid pattern background */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `radial-gradient(circle, #94a3b8 1px, transparent 1px)`,
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x % (24 * zoom)}px ${pan.y % (24 * zoom)}px`,
          }}
        />

        {/* Transformed content layer */}
        <div
          ref={contentRef}
          className="absolute"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {/* SVG layer for connectors */}
          <svg
            className="absolute pointer-events-none"
            style={{
              left: svgMinX,
              top: svgMinY,
              width: svgW,
              height: svgH,
              overflow: "visible",
            }}
          >
            <defs>
              <marker id="heartMarker" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8">
                <circle cx="5" cy="5" r="3" fill="#e11d48" />
              </marker>
            </defs>

            {pathData.map((p) => {
              if (p.heart) {
                return (
                  <g key={p.key}>
                    <circle cx={p.cx - svgMinX} cy={p.cy - svgMinY} r={5} fill="#e11d48" opacity="0.9" />
                    <text
                      x={p.cx - svgMinX}
                      y={p.cy - svgMinY + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="8"
                      fill="white"
                    >
                      ♥
                    </text>
                  </g>
                )
              }

              // Offset the path coordinates relative to the SVG viewBox
              const offsetD = p.d.replace(
                /(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g,
                (match, x, y) => `${parseFloat(x) - svgMinX} ${parseFloat(y) - svgMinY}`
              )

              return (
                <path
                  key={p.key}
                  d={offsetD}
                  fill="none"
                  stroke={p.stroke}
                  strokeWidth={p.strokeWidth}
                  strokeDasharray={p.strokeDasharray || "none"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )
            })}
          </svg>

          {/* Person node cards */}
          {personNodes}
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">
          <Button
            onClick={() => tree?.rootPerson && handleFocusPerson(tree.rootPerson)}
            size="sm"
            className="bg-gray-800/90 hover:bg-gray-900 text-white shadow-lg backdrop-blur-sm"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Focus Root
          </Button>
          {selectedPerson && (
            <Button
              onClick={() => setShowPersonDetails(!showPersonDetails)}
              size="sm"
              className="bg-blue-600/90 hover:bg-blue-700 text-white shadow-lg backdrop-blur-sm"
            >
              View Details
            </Button>
          )}
        </div>

        {/* Minimap-like info badge */}
        <div className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-gray-500 shadow-sm border">
          {countTotalMembers()} members • {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Selected Person Details Panel */}
      {selectedPerson && showPersonDetails && (
        <Card className="mt-4 max-w-4xl mx-auto shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {selectedPerson.firstName} {selectedPerson.lastName}
              </h3>
              <div className="flex items-center gap-2">
                {permissions.canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleEditMember(selectedPerson)}>
                      <Edit className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    {selectedPerson.id !== tree.rootPerson?.id && (
                      <Button size="sm" variant="outline" onClick={() => handleSetRootPerson(selectedPerson)}>
                        Set As Root
                      </Button>
                    )}
                    <Button size="sm" onClick={() => onAddMember(selectedPerson, "child")}>
                      <Baby className="h-4 w-4 mr-1" /> Add Child
                    </Button>
                    {!selectedPerson.spouse && (
                      <Button size="sm" onClick={() => onAddMember(selectedPerson, "spouse")}>
                        <Heart className="h-4 w-4 mr-1" /> Add Spouse
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => {
                        const hasBothParents = selectedPerson.parents && selectedPerson.parents.length === 2
                        if (hasBothParents) { alert("This person already has both parents") }
                        else { onAddMember(selectedPerson, "parent") }
                      }}
                      variant={selectedPerson.parents && selectedPerson.parents.length === 2 ? "secondary" : "default"}
                    >
                      <Users className="h-4 w-4 mr-1" />
                      {selectedPerson.parents && selectedPerson.parents.length === 2 ? "Has Both Parents" : "Add Parents"}
                    </Button>
                    {selectedPerson.parents && selectedPerson.parents.length > 0 && (
                      <Button size="sm" onClick={() => onAddMember(selectedPerson, "sibling")}>
                        <UserCheck className="h-4 w-4 mr-1" /> Add Sibling
                      </Button>
                    )}
                    {selectedPerson.spouse && (
                      <Button
                        size="sm"
                        onClick={() => {
                          const spouseHasBothParents = selectedPerson.spouse.parents && selectedPerson.spouse.parents.length === 2
                          if (spouseHasBothParents) { alert("Spouse already has both parents") }
                          else { onAddMember(selectedPerson.spouse, "parent") }
                        }}
                        variant={selectedPerson.spouse.parents && selectedPerson.spouse.parents.length === 2 ? "secondary" : "default"}
                      >
                        <Users className="h-4 w-4 mr-1" />
                        {selectedPerson.spouse.parents && selectedPerson.spouse.parents.length === 2
                          ? "Spouse Has Both Parents"
                          : "Add Spouse's Parents"}
                      </Button>
                    )}
                    {selectedPerson.spouse && !selectedPerson.isDeceased && !selectedPerson.spouse.isDeceased && (
                      <Button size="sm" variant="destructive" onClick={() => handleDivorce(selectedPerson)}>
                        <Unlink className="h-4 w-4 mr-1" /> Divorce
                      </Button>
                    )}
                    {selectedPerson.id !== tree.rootPerson?.id && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center">
                              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                              Delete Family Member
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete{" "}
                              <strong>{selectedPerson.firstName} {selectedPerson.lastName}</strong>{" "}
                              from the family tree? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteMember(selectedPerson.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                )}
                <Button size="sm" variant="ghost" onClick={() => setShowPersonDetails(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>Date of Birth:</strong>{" "}
                {selectedPerson.dob ? new Date(selectedPerson.dob).toLocaleDateString() : "Unknown"}
              </div>
              <div>
                <strong>Gender:</strong> {selectedPerson.gender}
              </div>
              <div>
                <strong>Status:</strong>{" "}
                {selectedPerson.isDeceased ? (
                  <span className="text-red-600 font-medium">
                    ✝ Deceased{" "}
                    {selectedPerson.dateOfDeath ? `(${new Date(selectedPerson.dateOfDeath).toLocaleDateString()})` : ""}
                  </span>
                ) : (
                  <span className="text-green-600 font-medium">Living</span>
                )}
              </div>
              {selectedPerson.placeOfBirth && (
                <div><strong>Place of Birth:</strong> {selectedPerson.placeOfBirth}</div>
              )}
              {selectedPerson.occupation && (
                <div><strong>Occupation:</strong> {selectedPerson.occupation}</div>
              )}
              {selectedPerson.currentAddress && (
                <div className="md:col-span-2"><strong>Current Address:</strong> {selectedPerson.currentAddress}</div>
              )}

              {selectedPerson.parents && selectedPerson.parents.length > 0 && (
                <div className="md:col-span-3 mt-4">
                  <strong>Parents:</strong>
                  <div className="flex space-x-4 mt-1">
                    {selectedPerson.parents.map((parent, index) => (
                      <Badge key={index} variant="outline">
                        {parent.firstName} {parent.lastName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedPerson.spouse && (
                <div className="md:col-span-3 mt-2">
                  <strong>Spouse:</strong>
                  <Badge variant="outline" className="ml-2">
                    {selectedPerson.spouse.firstName} {selectedPerson.spouse.lastName}
                  </Badge>
                  {selectedPerson.spouse.parents && selectedPerson.spouse.parents.length > 0 && (
                    <div className="mt-2">
                      <strong>Spouse's Parents:</strong>
                      <div className="flex space-x-2 mt-1">
                        {selectedPerson.spouse.parents.map((parent, index) => (
                          <Badge key={index} variant="outline">
                            {parent.firstName} {parent.lastName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedPerson.children && selectedPerson.children.length > 0 && (
                <div className="md:col-span-3 mt-2">
                  <strong>Children ({selectedPerson.children.length}):</strong>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedPerson.children.map((child, index) => (
                      <Badge key={index} variant="outline">
                        {child.firstName} {child.lastName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Member Dialog */}
      <EditMemberDialog
        open={showEditMember}
        onOpenChange={setShowEditMember}
        person={editingPerson}
        treeId={treeId}
        onMemberUpdated={handleMemberUpdated}
        tree={tree}
      />
    </div>
  )
}
