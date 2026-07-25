function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export const isBiometricSupported = async (): Promise<boolean> => {
  if (!window.PublicKeyCredential) return false;
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch (e) {
    return false;
  }
};

export const registerBiometrics = async (email: string, userData?: any): Promise<boolean> => {
  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    
    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const hostname = window.location.hostname;
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);

    const rpConfig: any = { name: "Quesos Kalu" };
    if (!isIp && hostname !== 'localhost') {
      rpConfig.id = hostname;
    }

    const credential: any = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: rpConfig,
        user: {
          id: userId,
          name: email,
          displayName: email
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, 
          { type: "public-key", alg: -257 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "preferred",
          residentKey: "preferred"
        },
        timeout: 60000
      }
    });

    if (credential && credential.rawId) {
      const rawIdBase64 = arrayBufferToBase64(credential.rawId);
      localStorage.setItem(`kalu_bio_${email}`, 'enabled');
      localStorage.setItem(`kalu_bio_raw_id_${email}`, rawIdBase64);
      localStorage.setItem(`kalu_bio_last_email`, email);
      if (userData) {
        localStorage.setItem(`kalu_bio_user_${email}`, JSON.stringify(userData));
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error registering biometrics:", error);
    return false;
  }
};

export const verifyBiometrics = async (email?: string): Promise<{ success: boolean; email?: string; userData?: any }> => {
  try {
    const targetEmail = email || localStorage.getItem('kalu_bio_last_email') || '';
    if (!targetEmail) return { success: false };

    const isEnabled = localStorage.getItem(`kalu_bio_${targetEmail}`) === 'enabled';
    if (!isEnabled) return { success: false };

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const rawIdBase64 = localStorage.getItem(`kalu_bio_raw_id_${targetEmail}`);
    let allowCredentials: any = undefined;
    if (rawIdBase64) {
      try {
        const rawIdBuffer = base64ToArrayBuffer(rawIdBase64);
        allowCredentials = [{
          type: 'public-key',
          id: rawIdBuffer
        }];
      } catch (e) {
        console.warn("Could not parse bio raw ID:", e);
      }
    }

    const hostname = window.location.hostname;
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);

    const publicKeyOptions: any = {
      challenge,
      userVerification: "preferred"
    };

    if (!isIp && hostname !== 'localhost') {
      publicKeyOptions.rpId = hostname;
    }

    if (allowCredentials) {
      publicKeyOptions.allowCredentials = allowCredentials;
    }

    const credential = await navigator.credentials.get({
      publicKey: publicKeyOptions
    });

    if (credential) {
      const savedUserData = localStorage.getItem(`kalu_bio_user_${targetEmail}`);
      const userData = savedUserData ? JSON.parse(savedUserData) : null;
      return { success: true, email: targetEmail, userData };
    }
    return { success: false };
  } catch (error) {
    console.error("Error verifying biometrics:", error);
    return { success: false };
  }
};

export const isBiometricsEnabledForUser = (email: string): boolean => {
  return localStorage.getItem(`kalu_bio_${email}`) === 'enabled';
};

export const getBiometricLastUserEmail = (): string | null => {
  const lastEmail = localStorage.getItem('kalu_bio_last_email');
  if (!lastEmail) return null;
  const isEnabled = localStorage.getItem(`kalu_bio_${lastEmail}`) === 'enabled';
  return isEnabled ? lastEmail : null;
};

export const getBiometricUserData = (email: string): any => {
  try {
    const data = localStorage.getItem(`kalu_bio_user_${email}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const removeBiometrics = (email: string) => {
  localStorage.removeItem(`kalu_bio_${email}`);
  localStorage.removeItem(`kalu_bio_raw_id_${email}`);
  localStorage.removeItem(`kalu_bio_user_${email}`);
  if (localStorage.getItem('kalu_bio_last_email') === email) {
    localStorage.removeItem('kalu_bio_last_email');
  }
};
