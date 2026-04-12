import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bot, Send, Sparkles, Coffee, Utensils, Beer, Zap } from 'lucide-react';
import { seedDemoData } from '@/lib/demo-seed';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

export default function AgenticSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "G'day! I'm Salty, your AI restaurant operations partner. I'll get your venue up and running in under 10 minutes. First up - what's your restaurant called?"
    }
  ]);
  const [input, setInput] = useState('');
  const [currentStep, setCurrentStep] = useState('venue_name');
  const [venueData, setVenueData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role: 'assistant' | 'user', content: string) => {
    setMessages(prev => [...prev, { role, content }]);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userInput = input.trim();
    setInput('');
    addMessage('user', userInput);
    
    // Process based on current step
    setTimeout(() => processUserInput(userInput), 500);
  };

  const processUserInput = async (userInput: string) => {
    switch (currentStep) {
      case 'venue_name':
        setVenueData({ ...venueData, name: userInput });
        setCurrentStep('square_check');
        addMessage('assistant', `Beautiful! ${userInput} - love it. Do you already use Square for payments?`);
        break;

      case 'square_check':
        if (userInput.toLowerCase().includes('yes')) {
          setCurrentStep('square_connect');
          addMessage('assistant', "Perfect! I'll connect to your Square account to import your menu, staff, and sales data automatically. This saves heaps of time!");
          setTimeout(() => {
            setCurrentStep('venue_type');
            addMessage('assistant', "While we're setting that up, what type of venue is " + venueData.name + "?");
          }, 1500);
        } else if (userInput.toLowerCase().includes('no')) {
          setCurrentStep('venue_type');
          addMessage('assistant', "No worries! We'll set things up manually. What type of venue is " + venueData.name + "?");
        }
        break;

      case 'venue_type':
        const venueType = userInput.toLowerCase();
        if (venueType.includes('restaurant') || venueType.includes('cafe') || 
            venueType.includes('bar') || venueType.includes('qsr') || venueType.includes('fast')) {
          setVenueData({ ...venueData, type: venueType });
          setCurrentStep('demo_or_real');
          addMessage('assistant', `Great! I've set up ${venueData.name} as a ${venueType}. Would you like me to load some demo data to explore SuperSolt, or shall we continue with your real setup?`);
        } else {
          addMessage('assistant', "What type of venue is it? Restaurant, cafe, bar, or quick service?");
        }
        break;

      case 'demo_or_real':
        if (userInput.toLowerCase().includes('demo')) {
          await loadDemoData();
        } else {
          setCurrentStep('complete');
          addMessage('assistant', `Brilliant! ${venueData.name} is all set up with the basics. You can now access your dashboard and I'll help you configure additional features over the coming days. Ready to see your new restaurant management system?`);
        }
        break;

      default:
        addMessage('assistant', "I'm here to help! What would you like to do next?");
    }
  };

  const handleQuickAction = async (action: string) => {
    switch (action) {
      case 'yes_square':
        setInput('yes');
        await handleSend();
        break;
      case 'no_square':
        setInput('no');
        await handleSend();
        break;
      case 'restaurant':
        setInput('restaurant');
        await handleSend();
        break;
      case 'cafe':
        setInput('cafe');
        await handleSend();
        break;
      case 'bar':
        setInput('bar');
        await handleSend();
        break;
      case 'qsr':
        setInput('quick service restaurant');
        await handleSend();
        break;
      case 'load_demo':
        setInput('load demo data');
        await handleSend();
        break;
      case 'continue_real':
        setInput('continue with real setup');
        await handleSend();
        break;
      case 'go_dashboard':
        navigate('/dashboard');
        break;
    }
  };

  const loadDemoData = async () => {
    setLoading(true);
    addMessage('assistant', "Loading demo data... This will just take a moment!");
    
    try {
      await seedDemoData(supabase, user?.id || 'test-user');
      setTimeout(() => {
        addMessage('assistant', "Perfect! I've loaded a complete demo restaurant with menu items, staff, and 30 days of sales data. You can explore all of SuperSolt's features right away!");
        setCurrentStep('complete');
        setLoading(false);
      }, 2000);
    } catch (error) {
      addMessage('assistant', "Oops, there was an issue loading the demo data. No worries, let's continue with your setup!");
      setLoading(false);
    }
  };

  const renderQuickActions = () => {
    switch (currentStep) {
      case 'square_check':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => handleQuickAction('yes_square')} className="justify-start">
              <Sparkles className="mr-2 h-4 w-4" />
              Yes, connect Square
            </Button>
            <Button variant="outline" onClick={() => handleQuickAction('no_square')} className="justify-start">
              No, I'll do this later
            </Button>
          </div>
        );

      case 'venue_type':
        return (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => handleQuickAction('restaurant')} className="justify-start">
              <Utensils className="mr-2 h-4 w-4" />
              Restaurant
            </Button>
            <Button variant="outline" onClick={() => handleQuickAction('cafe')} className="justify-start">
              <Coffee className="mr-2 h-4 w-4" />
              Cafe
            </Button>
            <Button variant="outline" onClick={() => handleQuickAction('bar')} className="justify-start">
              <Beer className="mr-2 h-4 w-4" />
              Bar
            </Button>
            <Button variant="outline" onClick={() => handleQuickAction('qsr')} className="justify-start">
              <Zap className="mr-2 h-4 w-4" />
              QSR/Fast Food
            </Button>
          </div>
        );

      case 'demo_or_real':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => handleQuickAction('load_demo')} className="justify-start">
              <Sparkles className="mr-2 h-4 w-4" />
              Load Demo Data
            </Button>
            <Button variant="outline" onClick={() => handleQuickAction('continue_real')} className="justify-start">
              Continue Setup
            </Button>
          </div>
        );

      case 'complete':
        return (
          <div className="grid grid-cols-1 gap-2">
            <Button onClick={() => handleQuickAction('go_dashboard')} className="justify-start">
              <Sparkles className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const getProgress = () => {
    switch (currentStep) {
      case 'venue_name': return 20;
      case 'square_check': return 40;
      case 'venue_type': return 60;
      case 'demo_or_real': return 80;
      case 'complete': return 100;
      default: return 0;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="h-[calc(100vh-2rem)] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b">
            <h2 className="text-xl font-semibold">Welcome to SuperSolt</h2>
            <div className="mt-2">
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>{getProgress()}% complete</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getProgress()}%` }}
                />
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === 'assistant' 
                    ? 'bg-muted' 
                    : 'bg-primary text-primary-foreground'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary animate-pulse" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <p className="text-sm">Thinking...</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {renderQuickActions() && (
            <div className="p-4 border-t">
              {renderQuickActions()}
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your message..."
                className="flex-1"
                disabled={loading}
              />
              <Button onClick={handleSend} size="icon" disabled={loading}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}