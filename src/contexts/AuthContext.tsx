import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session, SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface Organization {
  id: string;
  name: string;
}

interface Venue {
  id: string;
  name: string;
  org_id: string;
}

interface OrgMember {
  id: string;
  org_id: string;
  role: "owner" | "manager" | "supervisor" | "crew";
}

// Type for membership query result with joined organization
interface MembershipWithOrg {
  id: string;
  org_id: string;
  role: "owner" | "manager" | "supervisor" | "crew";
  organizations: Organization | null;
}

// Type for venue query result
interface VenueRow {
  id: string;
  name: string;
  org_id: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  organizations: Organization[];
  currentOrg: Organization | null;
  venues: Venue[];
  currentVenue: Venue | null;
  orgMember: OrgMember | null;
  loading: boolean;
  setCurrentOrg: (org: Organization) => void;
  setCurrentVenue: (venue: Venue) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [currentVenue, setCurrentVenue] = useState<Venue | null>(null);
  const [orgMember, setOrgMember] = useState<OrgMember | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user's profile and organizations
  const fetchUserData = async (userId: string) => {
    console.log("[AuthContext] fetchUserData started for userId:", userId);
    try {
      // Fetch profile
      console.log("[AuthContext] Fetching profile...");
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      console.log("[AuthContext] Profile result:", { profileData, profileError });

      if (profileData) {
        setProfile(profileData as Profile);
      }

      // Fetch user's organizations through org_members
      console.log("[AuthContext] Fetching org_members...");
      const { data: memberships, error: membershipsError } = await supabase
        .from("org_members")
        .select(`
          id,
          org_id,
          role,
          organizations (
            id,
            name
          )
        `)
        .eq("user_id", userId)
        .eq("is_active", true);

      console.log("[AuthContext] Memberships result:", { memberships, membershipsError });

      if (memberships && memberships.length > 0) {
        const orgs = (memberships as unknown as MembershipWithOrg[])
          .map((m) => m.organizations)
          .filter(Boolean) as Organization[];

        setOrganizations(orgs);

        // Set first org as current if none selected
        const savedOrgId = localStorage.getItem("currentOrgId");
        const savedOrg = orgs.find((o) => o.id === savedOrgId);
        const orgToUse = savedOrg || orgs[0];

        setCurrentOrg(orgToUse);

        // Get membership details for current org
        const currentMembership = (memberships as unknown as MembershipWithOrg[]).find(
          (m) => m.org_id === orgToUse.id
        );
        if (currentMembership) {
          setOrgMember({
            id: currentMembership.id,
            org_id: currentMembership.org_id,
            role: currentMembership.role,
          });
        }

        // Fetch venues for current org
        console.log("[AuthContext] Fetching venues...");
        await fetchVenues(orgToUse.id);
        console.log("[AuthContext] Venues fetched");
      }
      console.log("[AuthContext] fetchUserData completed");
    } catch (error) {
      console.error("[AuthContext] Error fetching user data:", error);
    }
  };

  const fetchVenues = async (orgId: string) => {
    const { data: venueData } = await supabase
      .from("venues")
      .select("id, name, org_id")
      .eq("org_id", orgId)
      .eq("is_active", true);

    if (venueData && venueData.length > 0) {
      const venues = venueData as VenueRow[];
      setVenues(venues);

      // Set first venue as current if none selected
      const savedVenueId = localStorage.getItem("currentVenueId");
      const savedVenue = venues.find((v) => v.id === savedVenueId);
      setCurrentVenue(savedVenue || venues[0]);
    }
  };

  const handleOrgChange = (org: Organization) => {
    setCurrentOrg(org);
    localStorage.setItem("currentOrgId", org.id);
    // Fetch venues for new org
    fetchVenues(org.id);
  };

  const handleVenueChange = (venue: Venue) => {
    setCurrentVenue(venue);
    localStorage.setItem("currentVenueId", venue.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setOrganizations([]);
    setCurrentOrg(null);
    setVenues([]);
    setCurrentVenue(null);
    setOrgMember(null);
    localStorage.removeItem("currentOrgId");
    localStorage.removeItem("currentVenueId");
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        // Don't await - let it run in background
        fetchUserData(session.user.id);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        // Don't await - let it run in background
        fetchUserData(session.user.id);
      } else {
        setProfile(null);
        setOrganizations([]);
        setCurrentOrg(null);
        setVenues([]);
        setCurrentVenue(null);
        setOrgMember(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        organizations,
        currentOrg,
        venues,
        currentVenue,
        orgMember,
        loading,
        setCurrentOrg: handleOrgChange,
        setCurrentVenue: handleVenueChange,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
