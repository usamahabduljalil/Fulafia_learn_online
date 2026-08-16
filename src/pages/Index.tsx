import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Video, Brain, TrendingUp, Users, MessageSquare, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  const features = [
    {
      icon: Video,
      title: "HD Video Conferencing",
      description: "Multi-participant video, audio, screen sharing, and reconnection powered by LiveKit"
    },
    {
      icon: Brain,
      title: "Privacy-First Analytics",
      description: "Local, observable attention, screen-focus, and participation signals without emotion inference"
    },
    {
      icon: TrendingUp,
      title: "Real-Time Engagement",
      description: "Live monitoring of student attention and participation levels"
    },
    {
      icon: Users,
      title: "Smart Classrooms",
      description: "Create and manage virtual classrooms with ease"
    },
    {
      icon: MessageSquare,
      title: "Live Feedback",
      description: "Instant alerts and suggestions to keep students engaged"
    },
    {
      icon: BarChart3,
      title: "Detailed Reports",
      description: "Comprehensive engagement reports for every student and session"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-hero text-primary-foreground">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTJoMnYyem0wLTRoLTJ2LTJoMnYyem0wLTRoLTJ2LTJoMnYyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-20"></div>
        <div className="container mx-auto px-4 py-24 relative">
          <div className="flex items-center justify-center mb-8">
            <div className="p-4 bg-primary-foreground/10 backdrop-blur-sm rounded-3xl shadow-glow">
              <GraduationCap className="h-16 w-16" />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-center mb-6">
            FULAFIA Online Class
          </h1>
          <p className="text-xl md:text-2xl text-center mb-8 text-primary-foreground/90 max-w-3xl mx-auto">
            Smarter Online Learning — Powered by Real-Time Attentiveness Intelligence
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="text-lg px-8" asChild>
              <Link to="/register">Get Started Free</Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 bg-primary-foreground/10 backdrop-blur-sm border-primary-foreground/20 hover:bg-primary-foreground/20" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Intelligent Virtual Classrooms</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            FULAFIA combines secure live teaching, coursework, attendance, and advisory engagement insights in one place.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="shadow-soft hover:shadow-glow transition-all">
              <CardHeader>
                <div className="p-3 bg-primary/10 rounded-xl w-fit mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
                <CardDescription className="text-base">{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Student devices calculate observable signals locally and share only numeric summaries.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="shadow-soft">
              <CardHeader>
                <div className="text-4xl font-bold text-primary mb-2">01</div>
                <CardTitle>Voice Analysis</CardTitle>
                <CardDescription>
                  Tracks speaking time, turn count, and word count locally; audio and transcripts are discarded.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="shadow-soft">
              <CardHeader>
                <div className="text-4xl font-bold text-primary mb-2">02</div>
                <CardTitle>Presence &amp; Liveness</CardTitle>
                <CardDescription>
                  Verifies session access and estimates face presence and head direction without inferring emotion.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="shadow-soft">
              <CardHeader>
                <div className="text-4xl font-bold text-primary mb-2">03</div>
                <CardTitle>Activity Tracking</CardTitle>
                <CardDescription>
                  Detects screen focus, tab switching, and overall engagement
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <Card className="max-w-3xl mx-auto shadow-glow bg-gradient-card">
          <CardContent className="pt-12 pb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Transform Your Virtual Classroom?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Bring live sessions, class resources, assignments, and thoughtful interventions into one secure workspace.
            </p>
            <Button size="lg" className="text-lg px-8" asChild>
              <Link to="/register">Create a Student Account</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 FULAFIA Online Class. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
