import clientPromise from "@/lib/mongodb"
import { requireAuthUser } from "@/lib/api-auth"
import {
  buildTreeCardForClient,
  canUserEditTree,
  getTreePermissions,
  grantSurnameEditorAccess,
  normalizeTreeDocument,
  saveTree,
} from "@/lib/family-tree-service"

export const dynamic = "force-dynamic"

export async function GET(request) {
  try {
    const client = await clientPromise
    const db = client.db("familytree")

    const { user, errorResponse } = await requireAuthUser(request, db)
    if (errorResponse) return errorResponse

    const rawTrees = await db.collection("familytrees").find({}).sort({ updatedAt: -1 }).toArray()
    const trees = []

    for (const rawTree of rawTrees) {
      const { tree, changed } = normalizeTreeDocument(rawTree)
      const grantedBySurname = grantSurnameEditorAccess(tree, user)

      if (changed || grantedBySurname) {
        await saveTree(db, tree)
      }

      if (!canUserEditTree(tree, user)) {
        continue
      }

      const permissions = getTreePermissions(tree, user)
      trees.push({
        ...buildTreeCardForClient(tree),
        canEdit: permissions.canEdit,
        isOwner: permissions.isOwner,
      })
    }

    return Response.json({ trees })
  } catch (error) {
    console.error("Get family trees error:", error)
    return Response.json({ message: "Internal server error" }, { status: 500 })
  }
}
