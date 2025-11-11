import { useState } from "react";
import InterviewCoach from "@/components/InterviewCoach";
import { Button } from "@/components/ui/button";

export default function TestCoach() {
  const [showCoach, setShowCoach] = useState(false);

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">Interview Coach Test Page</h1>
      
      {!showCoach ? (
        <Button 
          onClick={() => setShowCoach(true)}
          size="lg"
          className="bg-amber hover:bg-amber/90 text-charcoal"
        >
          Open Interview Coach
        </Button>
      ) : (
        <div className="max-w-4xl">
          <InterviewCoach onClose={() => setShowCoach(false)} />
        </div>
      )}
    </div>
  );
}
