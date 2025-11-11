import InterviewCoach from "@/components/InterviewCoach";

export default function IndividualCoaching() {
  return (
    <div className="container mx-auto p-6 max-w-6xl h-[calc(100vh-2rem)]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-coaching-title">
          AI Interview Coach
        </h1>
        <p className="text-muted-foreground">
          Practice your interview skills with Jabu, your AI-powered interview coach
        </p>
      </div>
      
      <div className="h-[calc(100%-5rem)]">
        <InterviewCoach />
      </div>
    </div>
  );
}
