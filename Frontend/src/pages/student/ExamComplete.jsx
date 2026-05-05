import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle, Button, Textarea } from "@/components/ui";
import { CheckCircle, Star, MessageCircle, Home } from "lucide-react";
import "./ExamComplete.css";

export default function ExamCompletePage() {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitFeedback = async () => {
    if (!feedback.trim() && rating === 0) return;
    
    setIsSubmitting(true);
    
    // Simulate feedback submission
    setTimeout(() => {
      navigate(createPageUrl("Dashboard"));
    }, 1500);
  };

  return (
    <div className="exam-complete">
      <div className="exam-complete-content">
        {/* Success Message */}
        <div className="exam-complete-header">
          <div className="exam-complete-icon">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h1 className="exam-complete-title">Exam Submitted Successfully!</h1>
          <p className="exam-complete-subtitle">Your responses have been recorded and are being reviewed.</p>
        </div>

        {/* Exam Summary */}
        <Card className="exam-complete-card">
          <CardHeader className="exam-complete-card-header">
            <CardTitle className="exam-complete-card-title">Submission Summary</CardTitle>
          </CardHeader>
          <CardContent className="exam-complete-card-content">
            <div className="exam-complete-summary-grid">
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <CheckCircle className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="font-semibold text-blue-900">Status</p>
                <p className="text-blue-700">Submitted</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                <MessageCircle className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <p className="font-semibold text-purple-900">Responses</p>
                <p className="text-purple-700">All Recorded</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <Star className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="font-semibold text-green-900">Proctoring</p>
                <p className="text-green-700">Completed</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-semibold text-amber-900 mb-2">What happens next?</h4>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• Your exam responses are being reviewed by the assessment team</li>
                <li>• Proctoring data will be analyzed for any integrity concerns</li>
                <li>• Results will be available within 5-7 business days</li>
                <li>• You will be notified via email when results are ready</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Feedback Form */}
        <Card className="exam-complete-card">
          <CardHeader className="exam-complete-card-header">
            <CardTitle className="exam-complete-feedback-title">
              <MessageCircle className="w-5 h-5" />
              Share Your Experience
            </CardTitle>
            <p className="exam-complete-feedback-subtitle">Help us improve the examination process</p>
          </CardHeader>
          <CardContent className="exam-complete-feedback-content">
            {/* Rating */}
            <div className="text-center">
              <p className="font-medium text-slate-900 mb-3">How was your exam experience?</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="transition-colors duration-200"
                  >
                    <Star 
                      className={`w-8 h-8 ${
                        star <= rating 
                          ? "text-yellow-400 fill-current" 
                          : "text-gray-300"
                      }`} 
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback Text */}
            <div className="space-y-3">
              <label htmlFor="feedback" className="block font-medium text-slate-900">
                Additional Comments (Optional)
              </label>
              <Textarea
                id="feedback"
                placeholder="Share your thoughts about the exam system, any issues you encountered, or suggestions for improvement..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="min-h-[100px] border-slate-200 focus:border-blue-500"
              />
            </div>

            <div className="flex gap-4">
              <Button
                onClick={() => navigate(createPageUrl("Dashboard"))}
                variant="outline"
                className="flex-1 h-12 rounded-xl"
              >
                <Home className="w-4 h-4 mr-2" />
                Skip & Return to Dashboard
              </Button>
              <Button
                onClick={submitFeedback}
                disabled={isSubmitting}
                className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 rounded-xl"
              >
                {isSubmitting ? "Submitting..." : "Submit Feedback"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}