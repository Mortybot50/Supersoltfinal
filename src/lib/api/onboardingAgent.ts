import { supabase } from '@/integrations/supabase/client';
import type { ConversationState, Message, QuickAction, VenueType } from '@/lib/types/onboarding';
import { squareImporter } from '@/lib/services/squareImporter';
import { venueIntelligence } from '@/lib/services/venueIntelligence';

export class ConversationEngine {
  private conversationState: ConversationState | null = null;

  async initialize(userId: string, orgId?: string): Promise<void> {
    // Load existing conversation or create new
    const { data } = await supabase
      .from('conversation_states')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      this.conversationState = {
        ...data,
        conversationHistory: data.conversation_history as Message[],
      };
    } else {
      this.conversationState = {
        id: crypto.randomUUID(),
        userId,
        orgId,
        conversationHistory: [],
        currentStep: 'welcome',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Add welcome message
      await this.addMessage('assistant', this.getWelcomeMessage());
    }
  }

  private getWelcomeMessage(): string {
    return "G'day! I'm Salty, your AI restaurant operations partner. I'll get your venue up and running in under 10 minutes. First up - what's your restaurant called?";
  }

  async processUserMessage(content: string): Promise<{
    message: string;
    quickActions?: QuickAction[];
  }> {
    if (!this.conversationState) throw new Error('Conversation not initialized');

    // Add user message
    await this.addMessage('user', content);

    // Process based on current step
    const response = await this.getResponseForStep(content);
    
    // Add assistant response
    await this.addMessage('assistant', response.message);
    
    await this.saveState();
    
    return response;
  }

  private async getResponseForStep(userInput: string): Promise<{
    message: string;
    quickActions?: QuickAction[];
  }> {
    const currentStep = this.conversationState?.currentStep || 'welcome';

    switch (currentStep) {
      case 'welcome':
        // User just provided venue name
        this.conversationState!.metadata.venueName = userInput;
        this.conversationState!.currentStep = 'square_check';
        
        return {
          message: `Beautiful! ${userInput} - love it. Do you already use Square for payments?`,
          quickActions: [
            { id: 'square-yes', label: 'Yes, connect Square', value: 'connect_square' },
            { id: 'square-later', label: "No, I'll do this later", value: 'skip_square' },
            { id: 'square-what', label: "What's Square?", value: 'explain_square' }
          ]
        };

      case 'square_check':
        if (userInput.toLowerCase().includes('yes') || userInput === 'connect_square') {
          this.conversationState!.currentStep = 'square_connecting';
          return {
            message: "Perfect! I'll connect to your Square account now. This lets me import your menu, staff, and recent sales data automatically.",
            quickActions: [
              { id: 'connect', label: 'Connect Square Account', value: 'oauth_square', action: 'custom' }
            ]
          };
        } else if (userInput === 'explain_square') {
          return {
            message: "Square is a popular payment system used by thousands of Australian restaurants. If you use Square, I can automatically import your menu items, staff list, and sales history - saves heaps of time!",
            quickActions: [
              { id: 'square-yes', label: 'I have Square - connect it', value: 'connect_square' },
              { id: 'square-no', label: 'I use something else', value: 'skip_square' }
            ]
          };
        } else {
          this.conversationState!.currentStep = 'venue_type';
          return this.getVenueTypePrompt();
        }

      case 'square_import_complete':
        const importSummary = this.conversationState!.metadata.importProgress;
        return {
          message: `Brilliant! I found:\n✓ ${importSummary?.catalog?.count || 0} menu items\n✓ ${importSummary?.team?.count || 0} active staff members\n✓ Sales data from the last 90 days\n\nYour restaurant is now set up with the basics. What would you like to do next?`,
          quickActions: [
            { id: 'view-dashboard', label: 'View Dashboard', value: 'go_dashboard', action: 'custom' },
            { id: 'setup-roster', label: 'Set Up Roster', value: 'setup_roster' },
            { id: 'add-suppliers', label: 'Add Suppliers', value: 'add_suppliers' }
          ]
        };

      case 'venue_type':
        return this.processVenueType(userInput);

      default:
        return {
          message: "I'm here to help! What would you like to set up next?",
          quickActions: [
            { id: 'dashboard', label: 'Go to Dashboard', value: 'go_dashboard', action: 'custom' },
            { id: 'help', label: 'Get Help', value: 'show_help' }
          ]
        };
    }
  }

  private getVenueTypePrompt(): {
    message: string;
    quickActions: QuickAction[];
  } {
    return {
      message: `What type of venue is ${this.conversationState!.metadata.venueName}?`,
      quickActions: [
        { id: 'restaurant', label: '🍕 Restaurant', value: 'restaurant' },
        { id: 'cafe', label: '☕ Cafe', value: 'cafe' },
        { id: 'bar', label: '🍺 Bar', value: 'bar' },
        { id: 'qsr', label: '🍔 QSR/Fast Food', value: 'qsr' }
      ]
    };
  }

  private async processVenueType(venueType: string): Promise<{
    message: string;
    quickActions?: QuickAction[];
  }> {
    this.conversationState!.metadata.venueType = venueType as VenueType;
    
    // Get smart defaults for this venue type
    const defaults = venueIntelligence.getSmartDefaults(venueType as VenueType);
    this.conversationState!.metadata.defaults = defaults;
    
    this.conversationState!.currentStep = 'basic_setup_complete';
    
    return {
      message: `Great! I've set up ${this.conversationState!.metadata.venueName} as a ${venueType}. You're ready to start using SuperSolt! I'll help you configure more features over the coming days.`,
      quickActions: [
        { id: 'dashboard', label: 'Go to Dashboard', value: 'go_dashboard', action: 'custom' },
        { id: 'demo', label: 'Load Demo Data', value: 'load_demo' },
        { id: 'next-setup', label: 'Continue Setup', value: 'continue_setup' }
      ]
    };
  }

  async handleSquareCallback(orgId: string, importData: any): Promise<void> {
    if (!this.conversationState) return;
    
    this.conversationState.metadata.squareConnected = true;
    this.conversationState.metadata.importProgress = {
      catalog: { status: 'importing' },
      team: { status: 'importing' },
      sales: { status: 'importing' },
      venue: { status: 'importing' }
    };
    
    // Start imports
    const results = await squareImporter.importAll(orgId, importData.accessToken);
    
    this.conversationState.metadata.importProgress = results;
    this.conversationState.currentStep = 'square_import_complete';
    
    await this.saveState();
  }

  private async addMessage(role: 'assistant' | 'user', content: string): Promise<void> {
    const message: Message = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: new Date()
    };
    
    this.conversationState!.conversationHistory.push(message);
  }

  private async saveState(): Promise<void> {
    if (!this.conversationState) return;
    
    await supabase.from('conversation_states').upsert({
      id: this.conversationState.id,
      user_id: this.conversationState.userId,
      org_id: this.conversationState.orgId,
      conversation_history: this.conversationState.conversationHistory,
      current_step: this.conversationState.currentStep,
      metadata: this.conversationState.metadata,
      updated_at: new Date().toISOString()
    });
  }
}

export const onboardingAgent = new ConversationEngine();