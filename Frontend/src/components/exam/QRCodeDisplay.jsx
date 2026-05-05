import React, { useState, useEffect } from "react";
import { CheckCircle } from "lucide-react";
import { Card, CardContent, Button, Alert, AlertDescription } from "@/components/ui";
import "./QRCodeDisplay.css";

export default function QRCodeDisplay({ sessionId, onConfirm }) {
  const [baseOrigin, setBaseOrigin] = useState(null);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_DETECTION_API_URL || "http://localhost:5000/api/v1";
    fetch(`${apiBase}/network-info`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ip) {
          setBaseOrigin(`https://${data.ip}:${window.location.port}`);
        } else {
          setBaseOrigin(window.location.origin);
        }
      })
      .catch(() => {
        setBaseOrigin(window.location.origin);
      });
  }, []);

  if (!baseOrigin) {
    return <div className="qr-layout"><p style={{ margin: "auto" }}>Loading QR code…</p></div>;
  }

  const mobileUrl = `${baseOrigin}/#/MobileCamera?sessionId=${sessionId}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(mobileUrl)}`;

  return (
    <div className="qr-layout">
      <aside className="qr-sidebar">
        <div className="qr-brand">ProctorGuard</div>
        <nav className="qr-nav">
          <a className="qr-nav-link" href="#/Dashboard">Student Home</a>
          <a className="qr-nav-link" href="#/Profile">My Profile</a>
        </nav>
        <div className="qr-sidebar-footer">
          <a className="qr-nav-link" href="#/Logout">Logout</a>
        </div>
      </aside>

      <main className="qr-main">
        <Card className="qr-card">
          <CardContent className="qr-card-content">
            <h1 className="qr-title">Secondary Camera Setup Required</h1>
            <div className="qr-code-card">
              <img
                src={qrCodeUrl}
                alt="QR Code for Mobile Camera"
                className="qr-code-image"
              />
            </div>
            <Alert className="qr-alert">
              <AlertDescription>
                <strong>Important:</strong> Keep the mobile camera page open throughout the entire exam. Closing it will be flagged as a violation.
              </AlertDescription>
            </Alert>
            <Button
              onClick={onConfirm}
              className="qr-confirm-btn"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Confirm Mobile Camera Setup Complete
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}