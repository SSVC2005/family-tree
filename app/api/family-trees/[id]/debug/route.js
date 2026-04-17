import clientPromise from "@/lib/mongodb"
import { requireAuthUser } from "@/lib/api-auth"
import { loadTreeById } from "@/lib/family-tree-service"

export const dynamic = "force-dynamic"

export async function GET(request, { params }) {
  try {
    const client = await clientPromise
    const db = client.db("familytree")

    const { errorResponse } = await requireAuthUser(request, db)
    if (errorResponse) return errorResponse

    const tree = await loadTreeById(db, params.id)
    if (!tree) {
      return Response.json({ message: "Family tree not found" }, { status: 404 })
    }

    return Response.json({
      tree: tree,
      debug: {
        schemaVersion: tree.schemaVersion,
        rootPersonId: tree.rootPersonId,
        totalMembers: tree.members?.length || 0,
        membersWithParents: (tree.members || []).filter((m) => (m.parentIds || []).length > 0).length,
        membersWithChildren: (tree.members || []).filter((m) => (m.childIds || []).length > 0).length,
        activeMarriages: (tree.members || []).filter((m) => Boolean(m.activeSpouseId)).length / 2,
      },
    })
  } catch (error) {
    console.error("Debug tree error:", error)
    return Response.json({ message: "Internal server error" }, { status: 500 })
  }
}
