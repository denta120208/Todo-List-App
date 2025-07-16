import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp,
  enableNetwork,
  disableNetwork
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyB9nip4NmKdSUFA23ajtoGOZCOIsDzLLJ8",
  authDomain: "sistem-informasi-karyawa-96da1.firebaseapp.com",
  databaseURL: "https://sistem-informasi-karyawa-96da1-default-rtdb.firebaseio.com",
  projectId: "sistem-informasi-karyawa-96da1",
  storageBucket: "sistem-informasi-karyawa-96da1.firebasestorage.app",
  messagingSenderId: "609979568042",
  appId: "1:609979568042:web:14f8ab016a352f479165d3",
  measurementId: "G-ZBH6ZRX4TX"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


class FirebaseService {
  static COLLECTION_NAME = 'users';
  static STORAGE_KEY = 'todos_offline';
  static isOnline = true;
  static currentUserId = null;

  // Initialize Firebase and anonymous auth
  static async initialize() {
    try {
      console.log('Initializing Firebase for platform:', Platform.OS);
      if (!auth.currentUser) {
        const result = await signInAnonymously(auth);
        this.currentUserId = result.user.uid;
        console.log('Anonymous user created:', this.currentUserId);
      } else {
        this.currentUserId = auth.currentUser.uid;
        console.log('User already authenticated:', this.currentUserId);
      }
      if (Platform.OS !== 'web') {
        try {
          await enableNetwork(db);
          console.log('Network enabled for Firestore');
        } catch (error) {
          console.log('Network enable error (might be already enabled):', error);
        }
      }
      return true;
    } catch (error) {
      console.error('Firebase initialization error:', error);
      return false;
    }
  }

  // Get user-specific collection reference
  static getUserCollection() {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    return collection(db, this.COLLECTION_NAME, this.currentUserId, 'todos');
  }

  // Save to local storage (offline fallback)
  static async saveToLocal(tasks) {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(tasks));
      console.log('Tasks saved to local storage');
    } catch (error) {
      console.error('Error saving to local storage:', error);
    }
  }

  // Load from local storage
  static async loadFromLocal() {
    try {
      const tasksString = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (tasksString) {
        const tasks = JSON.parse(tasksString);
        console.log('Tasks loaded from local storage:', tasks.length);
        return tasks;
      }
    } catch (error) {
      console.error('Error loading from local storage:', error);
    }
    return [];
  }

  // Add a new task
  static async addTask(task) {
    const taskWithTimestamp = {
      ...task,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    try {
      if (!this.currentUserId) {
        await this.initialize();
      }
      const docRef = await addDoc(this.getUserCollection(), {
        ...taskWithTimestamp,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log('Task added to Firestore with ID:', docRef.id);
      this.isOnline = true;
      return docRef.id;
    } catch (error) {
      console.error('Firestore add error:', error);
      this.isOnline = false;
      // Fallback to local storage
      console.log('Falling back to local storage...');
      const localTasks = await this.loadFromLocal();
      localTasks.unshift({ ...taskWithTimestamp, id: Date.now().toString() });
      await this.saveToLocal(localTasks);
      console.log('Task added to local storage');
      return taskWithTimestamp.id;
    }
  }

  // Get all tasks
  static async getTasks() {
    try {
      if (!this.currentUserId) {
        await this.initialize();
      }
      const q = query(this.getUserCollection(), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const tasks = [];
      querySnapshot.forEach((doc) => {
        tasks.push({
          id: doc.id,
          ...doc.data()
        });
      });
      console.log('Tasks loaded from Firestore:', tasks.length);
      this.isOnline = true;
      await this.saveToLocal(tasks);
      return tasks;
    } catch (error) {
      console.error('Firestore get error:', error);
      this.isOnline = false;
      // Fallback to local storage
      console.log('Loading from local storage...');
      const localTasks = await this.loadFromLocal();
      return localTasks;
    }
  }

  // Toggle task completion
  static async toggleTask(taskId, currentStatus) {
    try {
      if (!this.currentUserId) {
        await this.initialize();
      }
      const taskRef = doc(this.getUserCollection(), taskId);
      await updateDoc(taskRef, {
        completed: !currentStatus,
        updatedAt: serverTimestamp()
      });
      console.log('Task toggled in Firestore:', taskId);
      this.isOnline = true;
    } catch (error) {
      console.error('Error toggling task in Firestore:', error);
      this.isOnline = false;
      // Update local storage
      const localTasks = await this.loadFromLocal();
      const taskIndex = localTasks.findIndex(task => task.id === taskId);
      if (taskIndex !== -1) {
        localTasks[taskIndex].completed = !currentStatus;
        localTasks[taskIndex].updatedAt = new Date().toISOString();
        await this.saveToLocal(localTasks);
        console.log('Task toggled in local storage');
      }
    }
  }

  // Delete a task
  static async deleteTask(taskId) {
    try {
      if (!this.currentUserId) {
        await this.initialize();
      }
      await deleteDoc(doc(this.getUserCollection(), taskId));
      console.log('Task deleted from Firestore:', taskId);
      this.isOnline = true;
    } catch (error) {
      console.error('Error deleting task from Firestore:', error);
      this.isOnline = false;
      // Delete from local storage
      const localTasks = await this.loadFromLocal();
      const filteredTasks = localTasks.filter(task => task.id !== taskId);
      await this.saveToLocal(filteredTasks);
      console.log('Task deleted from local storage');
    }
  }

  // Set task priority
  static async setPriority(taskId, priority) {
    try {
      if (!this.currentUserId) {
        await this.initialize();
      }
      const taskRef = doc(this.getUserCollection(), taskId);
      await updateDoc(taskRef, {
        priority: priority,
        updatedAt: serverTimestamp()
      });
      console.log('Task priority updated in Firestore:', taskId, priority);
      this.isOnline = true;
    } catch (error) {
      console.error('Error setting priority in Firestore:', error);
      this.isOnline = false;
      // Update local storage
      const localTasks = await this.loadFromLocal();
      const taskIndex = localTasks.findIndex(task => task.id === taskId);
      if (taskIndex !== -1) {
        localTasks[taskIndex].priority = priority;
        localTasks[taskIndex].updatedAt = new Date().toISOString();
        await this.saveToLocal(localTasks);
        console.log('Task priority updated in local storage');
      }
    }
  }

  // Subscribe to real-time task updates
  static subscribeToTasks(callback) {
    try {
      if (!this.currentUserId) {
        this.initialize().then(() => {
          this._subscribe(callback);
        });
        return () => {};
      } else {
        return this._subscribe(callback);
      }
    } catch (error) {
      console.error('Error setting up real-time listener:', error);
      this.isOnline = false;
      // Return a function that loads from local storage
      return () => {
        this.loadFromLocal().then(localTasks => {
          callback(localTasks);
        });
      };
    }
  }

  static _subscribe(callback) {
    const q = query(this.getUserCollection(), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const tasks = [];
      querySnapshot.forEach((doc) => {
        tasks.push({
          id: doc.id,
          ...doc.data()
        });
      });
      console.log('Real-time update received:', tasks.length);
      this.isOnline = true;
      this.saveToLocal(tasks);
      callback(tasks);
    }, (error) => {
      console.error('Error in real-time listener:', error);
      this.isOnline = false;
      this.loadFromLocal().then(localTasks => {
        callback(localTasks);
      });
    });
    return unsubscribe;
  }

  // Check online status
  static getOnlineStatus() {
    return this.isOnline;
  }

  // Get Firebase app instance
  static getApp() {
    return app;
  }

  // Get Firestore instance
  static getDb() {
    return db;
  }
}

export default FirebaseService;
