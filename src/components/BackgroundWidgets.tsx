export default function BackgroundWidgets() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      {/* Mesh gradient base */}
      <div className="absolute inset-0 bg-mesh-gradient" />

      {/* Dot grid overlay */}
      <div className="absolute inset-0 bg-dot-grid opacity-60" />

      {/* Coral orb — top left with glow */}
      <div className="absolute -top-24 -left-24 w-[400px] h-[400px] rounded-full animate-float-slow">
        <div className="w-full h-full rounded-full bg-rausch/[0.05] blur-[80px]" />
      </div>

      {/* Teal orb — bottom right */}
      <div className="absolute -bottom-20 -right-20 w-[350px] h-[350px] rounded-full animate-float-slow-reverse">
        <div className="w-full h-full rounded-full bg-babu/[0.05] blur-[80px]" />
      </div>

      {/* Warm accent — center right */}
      <div className="absolute top-1/3 -right-12 w-[250px] h-[250px] rounded-full animate-float-diagonal">
        <div className="w-full h-full rounded-full bg-arches/[0.03] blur-[60px]" />
      </div>

      {/* Decorative ring — top right */}
      <div className="absolute top-20 right-16 w-[100px] h-[100px] rounded-full border border-hackberry/[0.04] animate-glow-pulse" />

      {/* Small floating circle — bottom left */}
      <div className="absolute bottom-32 left-20 w-[60px] h-[60px] rounded-full border border-rausch/[0.06] animate-float-diagonal" />
    </div>
  )
}
