import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@/components/ui";
import { Hand, AlertTriangle, Clock } from "lucide-react";

export default function IntegrityCheck({ isOpen, timeRemaining, onPass }) {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold text-orange-900 flex items-center justify-center gap-2">
            <Hand className="w-6 h-6 text-orange-600" />
            Integrity Check Required
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Hand className="w-10 h-10 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-orange-900 mb-2">
              Show Both Hands to Camera
            </h3>
            <p className="text-orange-700 text-sm">
              Hold both hands up clearly visible to the camera to continue your exam
            </p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-orange-200">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Clock className="w-5 h-5 text-orange-600" />
              <span className="text-lg font-bold text-orange-900">
                {timeRemaining} seconds remaining
              </span>
            </div>
            <div className="w-full bg-orange-100 rounded-full h-2">
              <div 
                className="bg-orange-600 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${(timeRemaining / 30) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-900 font-semibold text-sm">Warning</p>
                <p className="text-red-800 text-xs">
                  Failing to comply within the time limit may result in exam termination.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onPass}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              I've Shown My Hands
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}