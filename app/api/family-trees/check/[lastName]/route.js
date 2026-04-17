import clientPromise from "@/lib/mongodb"
import { requireAuthUser } from "@/lib/api-auth"
import { normalizeLastName, normalizeTreeDocument, saveTree } from "@/lib/family-tree-service"

export const dynamic = "force-dynamic"

export async function GET(request, { params }) {
  try {
    const client = await clientPromise
    const db = client.db("familytree")

    const { errorResponse } = await requireAuthUser(request, db)
    if (errorResponse) return errorResponse

    const requestedLastName = decodeURIComponent(params.lastName || "")
    const normalizedRequestedLastName = normalizeLastName(requestedLastName)

    if (!normalizedRequestedLastName) {
      return Response.json({ exists: false })
    }

    const existingRawTree = await db.collection("familytrees").findOne({
      normalizedLastName: normalizedRequestedLastName,
    })

    if (!existingRawTree) {
      return Response.json({ exists: false })
    }

    const { tree, changed } = normalizeTreeDocument(existingRawTree)
    if (changed) {
      await saveTree(db, tree)
    }

    return Response.json({ exists: true, treeId: String(tree._id) })
  } catch (error) {
    console.error("Check last name error:", error)
    return Response.json({ message: "Internal server error" }, { status: 500 })
  }
}
