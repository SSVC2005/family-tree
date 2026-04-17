import clientPromise from "@/lib/mongodb"
import { requireAuthUser } from "@/lib/api-auth"
import { getTreePermissions, grantSurnameEditorAccess, loadTreeById, saveTree } from "@/lib/family-tree-service"

export const dynamic = "force-dynamic"

export async function GET(request, { params }) {
  try {
    const client = await clientPromise
    const db = client.db("familytree")

    const { user, errorResponse } = await requireAuthUser(request, db)
    if (errorResponse) return errorResponse

    const tree = await loadTreeById(db, params.id)
    if (!tree) {
      return Response.json({ message: "Family tree not found" }, { status: 404 })
    }

    const granted = grantSurnameEditorAccess(tree, user)
    if (granted) {
      await saveTree(db, tree)
    }

    const permissions = getTreePermissions(tree, user)

    return Response.json({ permissions })
  } catch (error) {
    console.error("Get permissions error:", error)
    return Response.json({ message: "Internal server error" }, { status: 500 })
  }
}
