const MetaballBackground = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Base dark gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-surface-1" />
      
      {/* SVG Metaball Filter */}
      <svg className="absolute w-0 h-0">
        <defs>
          <filter id="metaball-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="20" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -10"
              result="metaball"
            />
            <feComposite in="SourceGraphic" in2="metaball" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Metaball Blobs Container */}
      <div 
        className="absolute inset-0"
        style={{ filter: 'url(#metaball-filter)' }}
      >
        {/* Volt Green Blob 1 - Large, slow */}
        <div 
          className="absolute w-[400px] h-[400px] rounded-full opacity-30 animate-blob-1"
          style={{
            background: 'radial-gradient(circle, hsl(72 100% 55%) 0%, transparent 70%)',
            top: '10%',
            left: '20%',
          }}
        />
        
        {/* Dark Gray Blob 2 */}
        <div 
          className="absolute w-[350px] h-[350px] rounded-full opacity-50 animate-blob-2"
          style={{
            background: 'radial-gradient(circle, hsl(240 6% 18%) 0%, transparent 70%)',
            top: '40%',
            right: '10%',
          }}
        />
        
        {/* Volt Green Blob 3 - Medium */}
        <div 
          className="absolute w-[300px] h-[300px] rounded-full opacity-25 animate-blob-3"
          style={{
            background: 'radial-gradient(circle, hsl(72 100% 55%) 0%, transparent 70%)',
            bottom: '20%',
            left: '10%',
          }}
        />
        
        {/* Surface Gray Blob 4 */}
        <div 
          className="absolute w-[450px] h-[450px] rounded-full opacity-40 animate-blob-4"
          style={{
            background: 'radial-gradient(circle, hsl(240 5% 12%) 0%, transparent 70%)',
            top: '60%',
            left: '40%',
          }}
        />
        
        {/* Small Volt Accent Blob */}
        <div 
          className="absolute w-[200px] h-[200px] rounded-full opacity-35 animate-blob-5"
          style={{
            background: 'radial-gradient(circle, hsl(72 100% 50%) 0%, transparent 70%)',
            top: '30%',
            right: '30%',
          }}
        />
        
        {/* Dark accent blob */}
        <div 
          className="absolute w-[280px] h-[280px] rounded-full opacity-45 animate-blob-6"
          style={{
            background: 'radial-gradient(circle, hsl(240 7% 8%) 0%, transparent 70%)',
            bottom: '10%',
            right: '20%',
          }}
        />
      </div>

      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Subtle vignette */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, hsl(240 7% 4% / 0.6) 100%)',
        }}
      />
    </div>
  );
};

export default MetaballBackground;
