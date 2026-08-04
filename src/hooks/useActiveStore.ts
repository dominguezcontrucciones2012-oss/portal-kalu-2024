import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Store } from '../types';

import { getActiveStoreId } from '../lib/dbUtils';

export function useActiveStore() {
  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [loadingStore, setLoadingStore] = useState(true);

  useEffect(() => {
    const storeId = getActiveStoreId();
    if (!storeId) {
      setLoadingStore(false);
      return;
    }

    const fetchStore = async () => {
      // Timeout de rescate de 3 segundos
      const timer = setTimeout(() => {
        setLoadingStore(false);
      }, 3000);

      try {
        const docRef = doc(db, 'stores', storeId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setActiveStore({ id: docSnap.id, ...docSnap.data() } as Store);
        }
      } catch (e) {
        console.error("Error fetching active store", e);
      } finally {
        clearTimeout(timer);
        setLoadingStore(false);
      }
    };

    fetchStore();
  }, []);

  return { activeStore, loadingStore };
}
