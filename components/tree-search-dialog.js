"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Users, Eye, Edit, Crown } from "lucide-react"
import { useRouter } from "next/navigation"

export default function TreeSearchDialog({ open, onOpenChange }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSearch = async (query) => {
    setSearchQuery(query)

    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`/api/family-trees/search?q=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.trees)
      }
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewTree = (treeId) => {
    router.push(`/family-tree/${treeId}`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Search className="h-5 w-5 mr-2" />
            Search Family Trees
          </DialogTitle>
          <DialogDescription>
            Search for any family tree. You can edit trees that match your last name.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Search by family name or person name..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="flex-1"
            />
            <Search className="h-4 w-4 text-gray-400" />
          </div>

          {loading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Searching...</p>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              <h4 className="font-medium text-gray-900">Search Results ({searchResults.length})</h4>
              {searchResults.map((tree) => (
                <Card key={tree._id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full bg-gray-200 border-2 border-gray-300 overflow-hidden flex items-center justify-center">
                          {tree.rootPerson.photo ? (
                            <img
                              src={tree.rootPerson.photo || "/placeholder.svg"}
                              alt={`${tree.rootPerson.firstName} ${tree.rootPerson.lastName}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Users className="h-6 w-6 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{tree.lastName} Family Tree</h3>
                          <p className="text-sm text-gray-600">
                            Root: {tree.rootPerson.firstName} {tree.rootPerson.lastName}
                          </p>
                          <p className="text-xs text-gray-500">
                            Created: {new Date(tree.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {tree.isOwner && (
                          <Badge variant="default" className="bg-purple-100 text-purple-800">
                            <Crown className="h-3 w-3 mr-1" />
                            Owner
                          </Badge>
                        )}
                        {tree.canEdit && !tree.isOwner && (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <Edit className="h-3 w-3 mr-1" />
                            Can Edit
                          </Badge>
                        )}
                        {!tree.canEdit && !tree.isOwner && (
                          <Badge variant="outline">
                            <Eye className="h-3 w-3 mr-1" />
                            View Only
                          </Badge>
                        )}

                        <Button size="sm" onClick={() => handleViewTree(tree._id)} className="ml-2">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && !loading && searchResults.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No family trees found matching "{searchQuery}"</p>
            </div>
          )}

          {searchQuery.length < 2 && (
            <div className="text-center py-8 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>Enter at least 2 characters to search</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
