export interface PushListenerHandle {
  remove: () => Promise<void>;
}

export const mockState = {
  checkPermissionsCalls: 0,
  requestPermissionsCalls: 0,
  registerCalls: 0,
  unregisterCalls: 0,
  listenersAdded: [] as { event: string; callback: Function }[],
  listenersRemovedCount: 0,
  simulateTimeout: false,
  simulateError: false,
  addListenerDelayMs: 0,
};

export function resetMockState() {
  mockState.checkPermissionsCalls = 0;
  mockState.requestPermissionsCalls = 0;
  mockState.registerCalls = 0;
  mockState.unregisterCalls = 0;
  mockState.listenersAdded = [];
  mockState.listenersRemovedCount = 0;
  mockState.simulateTimeout = false;
  mockState.simulateError = false;
  mockState.addListenerDelayMs = 0;
}

export function triggerPushReceived(push: any) {
  const matches = mockState.listenersAdded.filter((l) => l.event === 'pushNotificationReceived');
  for (const m of matches) {
    m.callback(push);
  }
}

export function triggerPushAction(action: any) {
  const matches = mockState.listenersAdded.filter((l) => l.event === 'pushNotificationActionPerformed');
  for (const m of matches) {
    m.callback(action);
  }
}

export function triggerRegistration(token: string) {
  const matches = mockState.listenersAdded.filter((l) => l.event === 'registration');
  for (const m of matches) {
    m.callback({ value: token });
  }
}

export const PushNotifications = {
  checkPermissions: async () => {
    mockState.checkPermissionsCalls++;
    return { receive: 'granted' };
  },
  requestPermissions: async () => {
    mockState.requestPermissionsCalls++;
    return { receive: 'granted' };
  },
  addListener: async (event: string, callback: Function): Promise<PushListenerHandle> => {
    if (mockState.addListenerDelayMs > 0) {
      await new Promise((r) => setTimeout(r, mockState.addListenerDelayMs));
    }
    const item = { event, callback };
    mockState.listenersAdded.push(item);
    return {
      remove: async () => {
        mockState.listenersRemovedCount++;
        const idx = mockState.listenersAdded.indexOf(item);
        if (idx !== -1) {
          mockState.listenersAdded.splice(idx, 1);
        }
      },
    };
  },
  register: async () => {
    mockState.registerCalls++;
    if (mockState.simulateError) {
      const errCallbacks = [...mockState.listenersAdded.filter((l) => l.event === 'registrationError')];
      for (const e of errCallbacks) {
        e.callback({ error: 'FCM native register error simulation' });
      }
      return;
    }

    if (mockState.simulateTimeout) {
      // Do nothing, let timeout expire
      return;
    }

    // Default: fire registration event promptly to all registered listeners
    const regCallbacks = [...mockState.listenersAdded.filter((l) => l.event === 'registration')];
    for (const r of regCallbacks) {
      r.callback({ value: 'mock_native_android_fcm_token_999' });
    }
  },
  unregister: async () => {
    mockState.unregisterCalls++;
  },
};
