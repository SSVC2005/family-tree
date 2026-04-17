"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function AddMemberDialog({ open, onOpenChange, selectedPerson, memberType, treeId, onMemberAdded }) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    placeOfBirth: "",
    fatherName: "",
    motherName: "",
    occupation: "",
    currentAddress: "",
    gender: "",
    photo: "",
    isDeceased: false,
    dateOfDeath: "",
    // Parent-specific fields
    fatherFirstName: "",
    fatherLastName: "",
    fatherDob: "",
    fatherOccupation: "",
    fatherIsDeceased: false,
    fatherDateOfDeath: "",
    motherFirstName: "",
    motherLastName: "",
    motherDob: "",
    motherOccupation: "",
    motherIsDeceased: false,
    motherDateOfDeath: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [isMinor, setIsMinor] = useState(false)

  // Reset form when dialog opens/closes or member type changes
  useEffect(() => {
    if (open && selectedPerson) {
      let defaultLastName = ""

      // Set default last name based on member type
      if (memberType === "child" || memberType === "sibling") {
        defaultLastName = selectedPerson.lastName
      } else if (memberType === "spouse") {
        defaultLastName = "" // Spouse keeps their own last name
      }

      // Set up parent names for children
      let defaultFatherName = ""
      let defaultMotherName = ""

      if (memberType === "child") {
        if (selectedPerson.gender === "male") {
          defaultFatherName = selectedPerson.firstName
          if (selectedPerson.spouse) {
            defaultMotherName = selectedPerson.spouse.firstName
          }
        } else if (selectedPerson.gender === "female") {
          defaultMotherName = selectedPerson.firstName
          if (selectedPerson.spouse) {
            defaultFatherName = selectedPerson.spouse.firstName
          }
        }
      } else if (memberType === "sibling") {
        defaultFatherName = selectedPerson.fatherName || ""
        defaultMotherName = selectedPerson.motherName || ""
      }

      setFormData({
        firstName: "",
        lastName: defaultLastName,
        dob: "",
        placeOfBirth: "",
        fatherName: defaultFatherName,
        motherName: defaultMotherName,
        occupation: "",
        currentAddress: selectedPerson.currentAddress || "",
        gender: "",
        photo: "",
        isDeceased: false,
        dateOfDeath: "",
        // Parent-specific fields
        fatherFirstName: "",
        fatherLastName: selectedPerson.lastName || "",
        fatherDob: "",
        fatherOccupation: "",
        fatherIsDeceased: false,
        fatherDateOfDeath: "",
        motherFirstName: "",
        motherLastName: "",
        motherDob: "",
        motherOccupation: "",
        motherIsDeceased: false,
        motherDateOfDeath: "",
      })
      setIsMinor(false)
      setError("")
    }
  }, [open, selectedPerson, memberType])

  // Check if person is minor based on DOB
  useEffect(() => {
    if (formData.dob) {
      const age = Math.floor((new Date() - new Date(formData.dob)) / (365.25 * 24 * 60 * 60 * 1000))
      setIsMinor(age < 18)

      // Clear occupation if minor
      if (age < 18 && formData.occupation) {
        setFormData((prev) => ({ ...prev, occupation: "" }))
      }
    }
  }, [formData.dob])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSelectChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setFormData({
          ...formData,
          photo: e.target.result,
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    // Validation for parent form
    if (memberType === "parent") {
      if (!formData.fatherFirstName && !formData.motherFirstName) {
        setError("At least one parent must be provided")
        setLoading(false)
        return
      }
    }

    try {
      const token = localStorage.getItem("token")
      const requestBody = {
        memberData: formData,
        memberType,
        parentId: selectedPerson?.id,
      }

      const response = await fetch(`/api/family-trees/${treeId}/add-member`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (response.ok) {
        onMemberAdded()
        onOpenChange(false)
        // Reset form
        setFormData({
          firstName: "",
          lastName: "",
          dob: "",
          placeOfBirth: "",
          fatherName: "",
          motherName: "",
          occupation: "",
          currentAddress: "",
          gender: "",
          photo: "",
          isDeceased: false,
          dateOfDeath: "",
          fatherFirstName: "",
          fatherLastName: "",
          fatherDob: "",
          fatherOccupation: "",
          fatherIsDeceased: false,
          fatherDateOfDeath: "",
          motherFirstName: "",
          motherLastName: "",
          motherDob: "",
          motherOccupation: "",
          motherIsDeceased: false,
          motherDateOfDeath: "",
        })
      } else {
        setError(data.message || "Failed to add member")
      }
    } catch (error) {
      console.error("Request error:", error)
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const getDialogTitle = () => {
    switch (memberType) {
      case "child":
        return `Add Child to ${selectedPerson?.firstName} ${selectedPerson?.lastName}`
      case "spouse":
        return `Add Spouse to ${selectedPerson?.firstName} ${selectedPerson?.lastName}`
      case "parent":
        return `Add Parents to ${selectedPerson?.firstName} ${selectedPerson?.lastName}`
      case "sibling":
        return `Add Sibling to ${selectedPerson?.firstName} ${selectedPerson?.lastName}`
      default:
        return "Add Family Member"
    }
  }

  const getDialogDescription = () => {
    switch (memberType) {
      case "child":
        return "Add a child to this family member. Parent names will be auto-filled based on the selected person and their spouse."
      case "spouse":
        return "Add a spouse to this family member. They will keep their original last name."
      case "parent":
        return "Add parents to this family member. Both parents will be connected as spouses automatically. Mother doesn't need to have the family last name."
      case "sibling":
        return "Add a sibling who shares the same parents."
      default:
        return "Add a new family member"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>{getDialogDescription()}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {memberType === "parent" ? (
            // Parent form - add both parents at once
            <div className="space-y-6">
              <div className="border rounded-lg p-4 bg-blue-50">
                <h4 className="font-semibold mb-3 text-blue-800">Father's Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fatherFirstName">First Name</Label>
                    <Input
                      id="fatherFirstName"
                      name="fatherFirstName"
                      value={formData.fatherFirstName || ""}
                      onChange={handleChange}
                      placeholder="Father's first name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatherLastName">Last Name</Label>
                    <Input
                      id="fatherLastName"
                      name="fatherLastName"
                      value={formData.fatherLastName || ""}
                      onChange={handleChange}
                      placeholder="Father's last name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatherDob">Date of Birth</Label>
                    <Input
                      id="fatherDob"
                      name="fatherDob"
                      type="date"
                      value={formData.fatherDob || ""}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatherOccupation">Occupation</Label>
                    <Input
                      id="fatherOccupation"
                      name="fatherOccupation"
                      value={formData.fatherOccupation || ""}
                      onChange={handleChange}
                      placeholder="Father's occupation"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.fatherIsDeceased || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            fatherIsDeceased: e.target.checked,
                            fatherDateOfDeath: e.target.checked ? formData.fatherDateOfDeath : "",
                          })
                        }
                      />
                      <span>Has passed away</span>
                    </Label>
                    {formData.fatherIsDeceased && (
                      <Input
                        type="date"
                        value={formData.fatherDateOfDeath || ""}
                        onChange={(e) => setFormData({ ...formData, fatherDateOfDeath: e.target.value })}
                        placeholder="Date of death"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-pink-50">
                <h4 className="font-semibold mb-3 text-pink-800">Mother's Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="motherFirstName">First Name</Label>
                    <Input
                      id="motherFirstName"
                      name="motherFirstName"
                      value={formData.motherFirstName || ""}
                      onChange={handleChange}
                      placeholder="Mother's first name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motherLastName">Last Name (Optional)</Label>
                    <Input
                      id="motherLastName"
                      name="motherLastName"
                      value={formData.motherLastName || ""}
                      onChange={handleChange}
                      placeholder="Mother's last name (can be different)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motherDob">Date of Birth</Label>
                    <Input
                      id="motherDob"
                      name="motherDob"
                      type="date"
                      value={formData.motherDob || ""}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motherOccupation">Occupation</Label>
                    <Input
                      id="motherOccupation"
                      name="motherOccupation"
                      value={formData.motherOccupation || ""}
                      onChange={handleChange}
                      placeholder="Mother's occupation"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.motherIsDeceased || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            motherIsDeceased: e.target.checked,
                            motherDateOfDeath: e.target.checked ? formData.motherDateOfDeath : "",
                          })
                        }
                      />
                      <span>Has passed away</span>
                    </Label>
                    {formData.motherIsDeceased && (
                      <Input
                        type="date"
                        value={formData.motherDateOfDeath || ""}
                        onChange={(e) => setFormData({ ...formData, motherDateOfDeath: e.target.value })}
                        placeholder="Date of death"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-3 rounded border border-green-200">
                <p className="text-sm text-green-700">
                  <strong>Note:</strong> Both parents will be automatically connected as spouses. Mother doesn't need to
                  have the family last name.
                </p>
              </div>
            </div>
          ) : (
            // Regular member form
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    placeholder="Enter first name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    placeholder={memberType === "spouse" ? "Enter spouse's last name" : "Enter last name"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input id="dob" name="dob" type="date" value={formData.dob} onChange={handleChange} required />
                  {isMinor && (
                    <p className="text-sm text-blue-600">Person is under 18 - occupation field will be hidden</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select onValueChange={(value) => handleSelectChange("gender", value)} value={formData.gender}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="photo">Photo (Optional)</Label>
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full bg-gray-200 border-2 border-gray-300 overflow-hidden flex items-center justify-center">
                    {formData.photo ? (
                      <img
                        src={formData.photo || "/placeholder.svg"}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <Input
                      id="photo"
                      name="photo"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-gray-500 mt-1">Upload a photo (JPG, PNG, GIF)</p>
                  </div>
                  {formData.photo && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ ...formData, photo: "" })}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="placeOfBirth">Place of Birth</Label>
                <Input
                  id="placeOfBirth"
                  name="placeOfBirth"
                  value={formData.placeOfBirth}
                  onChange={handleChange}
                  placeholder="Enter place of birth"
                />
              </div>

              {(memberType === "child" || memberType === "sibling") && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fatherName">Father's Name</Label>
                    <Input
                      id="fatherName"
                      name="fatherName"
                      value={formData.fatherName}
                      onChange={handleChange}
                      placeholder="Father's name (auto-filled)"
                      className="bg-blue-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="motherName">Mother's Name</Label>
                    <Input
                      id="motherName"
                      name="motherName"
                      value={formData.motherName}
                      onChange={handleChange}
                      placeholder="Mother's name (auto-filled if spouse exists)"
                      className="bg-blue-50"
                    />
                  </div>
                </div>
              )}

              {!isMinor && (
                <div className="space-y-2">
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input
                    id="occupation"
                    name="occupation"
                    value={formData.occupation}
                    onChange={handleChange}
                    placeholder="Enter occupation"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="currentAddress">Current Address</Label>
                <Input
                  id="currentAddress"
                  name="currentAddress"
                  value={formData.currentAddress}
                  onChange={handleChange}
                  placeholder="Enter current address"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isDeceased || false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isDeceased: e.target.checked,
                        dateOfDeath: e.target.checked ? formData.dateOfDeath : "",
                      })
                    }
                  />
                  <span>Has passed away</span>
                </Label>
                {formData.isDeceased && (
                  <div className="space-y-2">
                    <Label htmlFor="dateOfDeath">Date of Death</Label>
                    <Input
                      id="dateOfDeath"
                      name="dateOfDeath"
                      type="date"
                      value={formData.dateOfDeath || ""}
                      onChange={handleChange}
                      placeholder="Date of death"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : memberType === "parent" ? "Add Parents" : `Add ${memberType}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
