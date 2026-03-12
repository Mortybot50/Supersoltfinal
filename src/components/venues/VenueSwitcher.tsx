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
        <Button variant="ghost" className="gap-1.5 w-full justify-start max-w-full px-2 h-9">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span
            className="font-semibold truncate flex-1 min-w-0 text-left text-sm"
            title={currentVenue?.name || 'Select Venue'}
          >
            {currentVenue?.name || 'Select Venue'}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-popover min-w-[200px] max-w-[280px]">
        <DropdownMenuLabel>Switch Venue</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {venues.map((venue) => (
          <DropdownMenuItem
            key={venue.id}
            onClick={() => setCurrentVenue(venue)}
            className={currentVenue?.id === venue.id ? 'bg-accent' : ''}
          >
            <MapPin className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
            <span className="truncate" title={venue.name}>{venue.name}</span>
          </DropdownMenuItem>
        ))}
        {venues.length === 0 && (
          <DropdownMenuItem disabled>No venues available</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
