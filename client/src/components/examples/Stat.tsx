import Stat from '../Stat';

export default function StatExample() {
  return (
    <div className="p-8 bg-background">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Stat value="↓50%" label="Time-to-shortlist" trend="down" color="violet" />
        <Stat value="↓22%" label="Cost-per-hire" trend="down" color="cyan" />
        <Stat value="28%" label="Reduction in no-shows" color="green" />
      </div>
    </div>
  );
}
