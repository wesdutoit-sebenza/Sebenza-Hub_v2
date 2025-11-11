import GradientBlob from '../GradientBlob';

export default function GradientBlobExample() {
  return (
    <div className="grid grid-cols-2 gap-4 p-8">
      <div className="relative h-48 border rounded-2xl overflow-hidden">
        <GradientBlob variant="violet-cyan" />
        <div className="relative z-10 p-6">
          <p className="font-semibold">Violet-Cyan</p>
        </div>
      </div>
      <div className="relative h-48 border rounded-2xl overflow-hidden">
        <GradientBlob variant="cyan" />
        <div className="relative z-10 p-6">
          <p className="font-semibold">Cyan</p>
        </div>
      </div>
      <div className="relative h-48 border rounded-2xl overflow-hidden">
        <GradientBlob variant="green" />
        <div className="relative z-10 p-6">
          <p className="font-semibold">Green</p>
        </div>
      </div>
      <div className="relative h-48 border rounded-2xl overflow-hidden">
        <GradientBlob variant="amber" />
        <div className="relative z-10 p-6">
          <p className="font-semibold">Amber</p>
        </div>
      </div>
    </div>
  );
}
