import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './mock_auth';
import { NotificationProvider } from '../../src/context/NotificationContext';
import NotificationBell from '../../src/components/NotificationBell';
import {
  registerNativePushWithTimeout,
  subscribeDeviceToken,
  unsubscribeDeviceToken,
  resetSubscriptionDedupCache,
} from '../../src/services/notifications';
import {
  mockState,
  resetMockState,
  triggerPushReceived,
  triggerPushAction,
  triggerRegistration,
  PushNotifications,
} from './mock_push_notifications';

(window as any).__HuaPlayTest = {
  registerNativePushWithTimeout,
  subscribeDeviceToken,
  unsubscribeDeviceToken,
  resetSubscriptionDedupCache,
  mockState,
  resetMockState,
  triggerPushReceived,
  triggerPushAction,
  triggerRegistration,
  PushNotifications,
};

function HarnessApp() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <div style={{ padding: '8px', minHeight: '100vh', background: '#000' }}>
            {/* Desktop Navbar Bar */}
            <div id="desktop-bar" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <span style={{ color: '#aaa', fontSize: '12px' }}>Desktop Header</span>
              <NotificationBell className="bell-desktop" />
            </div>

            {/* Mobile Navbar Bar */}
            <div id="mobile-bar" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
              <span style={{ color: '#aaa', fontSize: '12px' }}>Mobile Header</span>
              <NotificationBell className="bell-mobile" />
            </div>

            <main id="main-content" style={{ marginTop: '24px', color: '#fff' }}>
              <h1>HuaPlay Test View</h1>
            </main>
          </div>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<HarnessApp />);
}
