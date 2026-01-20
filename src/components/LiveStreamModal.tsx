import { useState, useEffect } from 'react';
import { X, Send, Users, Heart, Volume2, VolumeX, Maximize2, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface LiveStreamModalProps {
  userName: string;
  userAvatar: string;
  workoutName: string;
  elapsed: string;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  userName: string;
  avatar: string;
  message: string;
  timestamp: Date;
  isSystem?: boolean;
  isVoice?: boolean;
}

export const LiveStreamModal = ({ 
  userName, 
  userAvatar, 
  workoutName, 
  elapsed, 
  onClose 
}: LiveStreamModalProps) => {
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', userName: 'System', avatar: '⚡', message: `${userName} started streaming "${workoutName}"`, timestamp: new Date(Date.now() - 1200000), isSystem: true },
    { id: '2', userName: 'FightFan99', avatar: '👊', message: 'Let\'s go!! 🔥', timestamp: new Date(Date.now() - 900000) },
    { id: '3', userName: 'BoxingCoach', avatar: '🥊', message: 'Nice form on those jabs!', timestamp: new Date(Date.now() - 600000) },
    { id: '4', userName: 'TrainingBuddy', avatar: '💪', message: 'Keep it up!', timestamp: new Date(Date.now() - 300000) },
    { id: '5', userName: 'NewFighter', avatar: '🥋', message: 'This is inspiring', timestamp: new Date(Date.now() - 60000) },
  ]);
  const [isMuted, setIsMuted] = useState(false);
  const [viewerCount, setViewerCount] = useState(23);
  const [currentTime, setCurrentTime] = useState(elapsed);
  const [isRecording, setIsRecording] = useState(false);
  const [showChat, setShowChat] = useState(true);

  // Speech recognition setup
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        
        if (event.results[0].isFinal) {
          // Send voice message
          const newMessage: ChatMessage = {
            id: crypto.randomUUID(),
            userName: 'You',
            avatar: '⚡',
            message: transcript,
            timestamp: new Date(),
            isVoice: true,
          };
          setMessages(prev => [...prev, newMessage]);
          setIsRecording(false);
        }
      };

      recognitionInstance.onerror = () => {
        setIsRecording(false);
      };

      recognitionInstance.onend = () => {
        setIsRecording(false);
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  // Simulate time passing
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const [mins, secs] = prev.split(':').map(Number);
        const totalSecs = mins * 60 + secs + 1;
        const newMins = Math.floor(totalSecs / 60);
        const newSecs = totalSecs % 60;
        return `${newMins}:${newSecs.toString().padStart(2, '0')}`;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Simulate viewer count fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount(prev => prev + Math.floor(Math.random() * 3) - 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      userName: 'You',
      avatar: '⚡',
      message: chatMessage,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, newMessage]);
    setChatMessage('');
  };

  const handleVoiceMessage = () => {
    if (!recognition) return;
    
    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      recognition.start();
      setIsRecording(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Video Area - Placeholder */}
      <div className="relative flex-1 bg-gradient-to-br from-surface-1 to-surface-2 flex items-center justify-center">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Live Indicator */}
        <div className="absolute top-4 right-4 flex items-center gap-3">
          <div className="flex items-center gap-2 bg-red-500 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs font-bold text-white uppercase">Live</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <Users className="w-3.5 h-3.5 text-white" />
            <span className="text-xs font-medium text-white">{viewerCount}</span>
          </div>
        </div>

        {/* Placeholder Content */}
        <div className="text-center">
          <div className="w-24 h-24 rounded-full bg-surface-3 flex items-center justify-center text-5xl mx-auto mb-4 animate-pulse">
            {userAvatar}
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">{userName}</h2>
          <p className="text-sm text-muted-foreground mb-2">{workoutName}</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-volt font-mono font-bold">{currentTime}</span>
            <span className="text-muted-foreground">elapsed</span>
          </div>
          <p className="text-xs text-muted-foreground mt-4 max-w-xs mx-auto">
            Live video streaming coming soon. For now, enjoy the live chat!
          </p>
        </div>

        {/* Controls Overlay */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowChat(!showChat)}
              className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full text-white hover:bg-black/70 transition-colors"
            >
              <span className="text-sm font-medium">{showChat ? 'Hide' : 'Show'} Chat</span>
            </button>
            <button className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full text-white hover:bg-black/70 transition-colors">
              <Heart className="w-4 h-4" />
              <span className="text-sm font-medium">Support</span>
            </button>
            <button className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors">
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Chat Section */}
      {showChat && (
        <div className="h-[40%] bg-surface-1 border-t border-surface-3 flex flex-col">
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-surface-3">
            <h3 className="font-semibold text-foreground text-sm">Live Chat</h3>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={cn(
                  'flex items-start gap-2',
                  msg.isSystem && 'opacity-60'
                )}
              >
                <span className="text-lg">{msg.avatar}</span>
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    'text-xs font-semibold',
                    msg.userName === 'You' ? 'text-volt' : 'text-foreground'
                  )}>
                    {msg.userName}
                    {msg.isVoice && <Mic className="w-3 h-3 inline ml-1 text-volt" />}
                  </span>
                  <span className="text-sm text-muted-foreground ml-2">
                    {msg.message}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="px-4 py-3 border-t border-surface-3 safe-bottom">
            <div className="flex gap-2">
              <Input
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Say something..."
                className="flex-1 bg-surface-2 border-surface-3"
              />
              <Button 
                onClick={handleVoiceMessage}
                variant="outline"
                className={cn(
                  "px-3 border-surface-3",
                  isRecording && "bg-volt text-primary-foreground border-volt animate-pulse"
                )}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button 
                onClick={handleSendMessage}
                className="bg-volt text-primary-foreground px-4"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
