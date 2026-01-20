const PerspectiveGridBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base dark gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-tech-black via-background to-tech-black" />
      
      {/* Perspective grid container */}
      <div 
        className="absolute inset-0 flex items-end justify-center"
        style={{ perspective: '1000px' }}
      >
        <div 
          className="w-[200%] h-[80%] animate-grid-scroll"
          style={{
            transform: 'rotateX(60deg)',
            transformOrigin: 'center top',
            background: `
              linear-gradient(90deg, hsl(var(--electric-volt) / 0.12) 1px, transparent 1px),
              linear-gradient(0deg, hsl(var(--electric-volt) / 0.12) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>
      
      {/* Animated glow orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute w-[600px] h-[600px] rounded-full animate-glow-drift-1 blur-[120px]"
          style={{
            background: 'radial-gradient(circle, hsl(var(--electric-volt) / 0.15) 0%, transparent 70%)',
            left: '-10%',
            bottom: '10%',
          }}
        />
        <div 
          className="absolute w-[500px] h-[500px] rounded-full animate-glow-drift-2 blur-[100px]"
          style={{
            background: 'radial-gradient(circle, hsl(var(--electric-volt) / 0.1) 0%, transparent 60%)',
            right: '-15%',
            bottom: '20%',
          }}
        />
        <div 
          className="absolute w-[400px] h-[400px] rounded-full animate-glow-drift-3 blur-[80px]"
          style={{
            background: 'radial-gradient(circle, hsl(var(--surface-2) / 0.3) 0%, transparent 60%)',
            left: '30%',
            bottom: '5%',
          }}
        />
      </div>
      
      {/* Top fade for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-tech-black via-tech-black/80 to-transparent" />
      
      {/* Subtle noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
};

export default PerspectiveGridBackground;
