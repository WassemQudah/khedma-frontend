import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCHPQ45LqZyxklFhDb40_peNMHZ3thBvWA",
  authDomain: "new-graduation-project.firebaseapp.com",
  projectId: "new-graduation-project",
  storageBucket: "new-graduation-project.firebasestorage.app",
  messagingSenderId: "931653231190",
  appId: "1:931653231190:web:a48454420a423e86a911f7",
  measurementId: "G-T9YE1S73TV",
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);

/**
 * Uploads a File to Firebase Storage and returns the public download URL.
 * @param {File}     file       - The file object from an <input type="file">
 * @param {string}   folder     - Storage folder path, e.g. "profiles" or "avatars"
 * @param {Function} onProgress - Optional callback(percent: number)
 * @returns {Promise<string>}   - Resolves with the download URL
 */
export function uploadFile(file, folder = "uploads", onProgress = null) {
  return new Promise((resolve, reject) => {
    const ext      = file.name.split(".").pop();
    const filename = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const storageRef = ref(storage, filename);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      "state_changed",
      (snap) => {
        if (onProgress) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      (err) => reject(err),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      },
    );
  });
}
