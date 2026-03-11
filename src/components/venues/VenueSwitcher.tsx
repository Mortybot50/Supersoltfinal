import { useAuth } from '@/contexts/AuthContext';
import { ChevronDown, MapPin } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

/**
 * Global venue switcher for the app header.
 * Shows individual venues only. Persists selection via AuthContext (localStorage-backed).
 */
export default function VenueSwitcher() {
  const { currentVenue, venues, setCurrentVenue } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">
            {currentVenue?.name || 'Select Venue'}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-popover min-w-[200px]">
        <DropdownMenuLabel>Switch Venue</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {venues.map((venue) => (
          <DropdownMenuItem
            key={venue.id}
            onClick={() => setCurrentVenue(venue)}
            className={currentVenue?.id === venue.id ? 'bg-accent' : ''}
          >
            <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
            {venue.name}
          </DropdownMenuItem>
        ))}
        {venues.length === 0 && (
          <DropdownMenuItem disabled>No venues available</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
