"use client"

import { Building2, MapPin } from "lucide-react"
import { OrgVenueSwitcher } from "@/components/OrgVenueSwitcher"
import { UserMenu } from "@/components/user-menu"

export function TopBar() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4">
      <div className="flex flex-1 items-center gap-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <OrgVenueSwitcher />
        </div>
        
        <div className="ml-auto">
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
