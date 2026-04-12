import type { VenueType, VenueDefaults } from '@/lib/types/onboarding';

class VenueIntelligence {
  detectVenueType(menuItems: any[], businessHours?: any): VenueType {
    // Analyze menu items to detect venue type
    const itemNames = menuItems.map(item => item.name.toLowerCase());
    
    // Check for coffee/cafe indicators
    const coffeeItems = itemNames.filter(name => 
      name.includes('latte') || name.includes('cappuccino') || 
      name.includes('espresso') || name.includes('flat white')
    ).length;
    
    // Check for alcohol/bar indicators
    const alcoholItems = itemNames.filter(name =>
      name.includes('beer') || name.includes('wine') || 
      name.includes('cocktail') || name.includes('spirits')
    ).length;
    
    // Check for QSR indicators
    const qsrIndicators = itemNames.filter(name =>
      name.includes('combo') || name.includes('meal deal') ||
      name.includes('value') || name.includes('kids meal')
    ).length;
    
    // Decision logic
    if (coffeeItems > 5 && alcoholItems < 3) return 'cafe';
    if (alcoholItems > 10) return 'bar';
    if (qsrIndicators > 3) return 'qsr';
    
    return 'restaurant'; // default
  }

  getSmartDefaults(venueType: VenueType): VenueDefaults {
    const baseDefaults: VenueDefaults = {
      tradingHours: {},
      features: [],
      suggestedIntegrations: ['square'],
      taxSettings: {
        gstRegistered: true,
        basReporting: 'quarterly'
      }
    };

    switch (venueType) {
      case 'cafe':
        return {
          ...baseDefaults,
          tradingHours: {
            monday: { open: '06:00', close: '16:00' },
            tuesday: { open: '06:00', close: '16:00' },
            wednesday: { open: '06:00', close: '16:00' },
            thursday: { open: '06:00', close: '16:00' },
            friday: { open: '06:00', close: '16:00' },
            saturday: { open: '07:00', close: '16:00' },
            sunday: { open: '07:00', close: '16:00' }
          },
          features: ['coffee', 'breakfast', 'lunch', 'takeaway'],
          suggestedIntegrations: ['square', 'uber-eats', 'doordash']
        };

      case 'bar':
        return {
          ...baseDefaults,
          tradingHours: {
            monday: { open: '16:00', close: '23:00' },
            tuesday: { open: '16:00', close: '23:00' },
            wednesday: { open: '16:00', close: '23:00' },
            thursday: { open: '16:00', close: '00:00' },
            friday: { open: '16:00', close: '02:00' },
            saturday: { open: '14:00', close: '02:00' },
            sunday: { open: '14:00', close: '22:00' }
          },
          features: ['bar', 'cocktails', 'wine', 'beer', 'spirits'],
          suggestedIntegrations: ['square', 'rsm', 'security-cameras']
        };

      case 'qsr':
        return {
          ...baseDefaults,
          tradingHours: {
            monday: { open: '10:00', close: '22:00' },
            tuesday: { open: '10:00', close: '22:00' },
            wednesday: { open: '10:00', close: '22:00' },
            thursday: { open: '10:00', close: '22:00' },
            friday: { open: '10:00', close: '23:00' },
            saturday: { open: '10:00', close: '23:00' },
            sunday: { open: '10:00', close: '22:00' }
          },
          features: ['quick-service', 'takeaway', 'delivery', 'drive-through'],
          suggestedIntegrations: ['square', 'uber-eats', 'menulog', 'doordash']
        };

      case 'restaurant':
      default:
        return {
          ...baseDefaults,
          tradingHours: {
            monday: null, // Closed Mondays (common for restaurants)
            tuesday: { open: '17:00', close: '22:00' },
            wednesday: { open: '17:00', close: '22:00' },
            thursday: { open: '17:00', close: '22:00' },
            friday: { open: '12:00', close: '23:00' },
            saturday: { open: '12:00', close: '23:00' },
            sunday: { open: '12:00', close: '21:00' }
          },
          features: ['dine-in', 'table-service', 'reservations', 'wine-list'],
          suggestedIntegrations: ['square', 'opentable', 'xero']
        };
    }
  }

  suggestNextSteps(venueType: VenueType, completedSteps: string[]): string[] {
    const suggestions: string[] = [];
    
    // Universal suggestions
    if (!completedSteps.includes('roster')) {
      suggestions.push('Set up your roster and shifts');
    }
    
    if (!completedSteps.includes('suppliers')) {
      suggestions.push('Add your suppliers for easier ordering');
    }
    
    // Venue-specific suggestions
    switch (venueType) {
      case 'cafe':
        if (!completedSteps.includes('coffee-training')) {
          suggestions.push('Upload coffee training materials');
        }
        if (!completedSteps.includes('breakfast-menu')) {
          suggestions.push('Configure breakfast menu timing');
        }
        break;
        
      case 'bar':
        if (!completedSteps.includes('rsm')) {
          suggestions.push('Set up Responsible Service records');
        }
        if (!completedSteps.includes('security')) {
          suggestions.push('Configure security protocols');
        }
        break;
        
      case 'restaurant':
        if (!completedSteps.includes('reservations')) {
          suggestions.push('Connect reservation system');
        }
        if (!completedSteps.includes('wine-inventory')) {
          suggestions.push('Set up wine inventory tracking');
        }
        break;
        
      case 'qsr':
        if (!completedSteps.includes('delivery-zones')) {
          suggestions.push('Configure delivery zones');
        }
        if (!completedSteps.includes('peak-staffing')) {
          suggestions.push('Set up peak hour staffing templates');
        }
        break;
    }
    
    return suggestions.slice(0, 3); // Return top 3 suggestions
  }
}

export const venueIntelligence = new VenueIntelligence();