import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import FirebaseService from './firebaseService-mobile';


const { width, height } = Dimensions.get('window');

const SuperCoolTodoApp = () => {
  const [tasks, setTasks] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState('all');
  const [darkMode, setDarkMode] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.9));
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Initialize Firebase listener and entrance animation
  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    // Initialize Firebase
    initializeApp();

    // Cleanup listener on unmount
    return () => {
      if (window.unsubscribeTasks) {
        window.unsubscribeTasks();
      }
    };
  }, []);

  // Initialize Firebase and set up listeners
  const initializeApp = async () => {
    try {
      setLoading(true);
      console.log('Starting app initialization...');
      
      // Initialize Firebase with mobile optimizations
      await FirebaseService.initialize();
      setIsAuthenticated(true);
      
      // Set up real-time listener for tasks
      const unsubscribe = FirebaseService.subscribeToTasks((tasksFromFirestore) => {
        // Only update if tasks are different to avoid overriding local state
        setTasks(prevTasks => {
          const tasksChanged = JSON.stringify(prevTasks) !== JSON.stringify(tasksFromFirestore);
          if (tasksChanged) {
            console.log('Tasks updated from server:', tasksFromFirestore.length);
            return tasksFromFirestore;
          }
          return prevTasks;
        });
        setIsOnline(FirebaseService.getOnlineStatus());
        setLoading(false);
      });
      
      // Store unsubscribe function for cleanup
      window.unsubscribeTasks = unsubscribe;
      
      // Load initial tasks
      await loadTasks();
      
    } catch (error) {
      console.error('Error initializing app:', error);
      
      let errorMessage = 'Gagal menginisialisasi aplikasi.';
      if (error.code === 'network-request-failed') {
        errorMessage = 'Tidak ada koneksi internet. Mode offline diaktifkan.';
      }
      
      Alert.alert('Info', errorMessage);
      setLoading(false);
      setIsAuthenticated(true); // Allow offline mode
      setIsOnline(false);
    }
  };

  // Load tasks from Firebase
  const loadTasks = async () => {
    try {
      setLoading(true);
      const tasksFromFirestore = await FirebaseService.getTasks();
      setTasks(tasksFromFirestore);
    } catch (error) {
      console.error('Error loading tasks:', error);
      Alert.alert('Error', 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };



  const addTask = async () => {
    if (!inputValue.trim()) {
      Alert.alert('Peringatan', 'Mohon masukkan teks untuk task');
      return;
    }

    try {
      const newTask = {
        text: inputValue.trim(),
        completed: false,
        priority: 'medium',
      };
      
      console.log('Adding task:', newTask);
      await FirebaseService.addTask(newTask);
      console.log('Task added successfully');
      setInputValue('');
      
      // Update online status
      setIsOnline(FirebaseService.getOnlineStatus());
      
      // Add animation for new task
      Animated.spring(scaleAnim, {
        toValue: 1.02,
        friction: 4,
        useNativeDriver: true,
      }).start(() => {
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }).start();
      });
    } catch (error) {
      console.error('Error adding task:', error);
      setIsOnline(FirebaseService.getOnlineStatus());
      
      let errorMessage = 'Task disimpan offline';
      if (error.code === 'permission-denied') {
        errorMessage = 'Task disimpan offline. Akan disinkronisasi nanti.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Task disimpan offline. Periksa koneksi internet.';
      } else if (error.code === 'network-request-failed') {
        errorMessage = 'Task disimpan offline. Tidak ada koneksi internet.';
      }
      
      // Don't show error for offline mode - just a success message
      if (!isOnline) {
        console.log('Task saved in offline mode');
      }
    }
  };

  const toggleTask = async (id) => {
    try {
      const task = tasks.find(task => task.id === id);
      if (task) {
        console.log('Toggling task:', id, 'current status:', task.completed);
        await FirebaseService.toggleTask(id, task.completed);
        
        // Update online status
        setIsOnline(FirebaseService.getOnlineStatus());
        
        // Update local state immediately for better UX
        setTasks(prevTasks => 
          prevTasks.map(t => 
            t.id === id ? { ...t, completed: !t.completed } : t
          )
        );
      }
    } catch (error) {
      console.error('Error toggling task:', error);
      setIsOnline(FirebaseService.getOnlineStatus());
      
      // Still update local state even if online update failed
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === id ? { ...t, completed: !t.completed } : t
        )
      );
    }
  };

  const deleteTask = async (id) => {
    try {
      Alert.alert(
        'Hapus Task',
        'Apakah Anda yakin ingin menghapus task ini?',
        [
          {
            text: 'Batal',
            style: 'cancel',
          },
          {
            text: 'Hapus',
            style: 'destructive',
            onPress: async () => {
              try {
                console.log('Deleting task:', id);
                await FirebaseService.deleteTask(id);
                
                // Update online status
                setIsOnline(FirebaseService.getOnlineStatus());
                
                // Update local state immediately
                setTasks(prevTasks => prevTasks.filter(t => t.id !== id));
                
              } catch (error) {
                console.error('Error deleting task:', error);
                setIsOnline(FirebaseService.getOnlineStatus());
                
                // Still update local state even if online delete failed
                setTasks(prevTasks => prevTasks.filter(t => t.id !== id));
              }
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error in delete task:', error);
    }
  };

  const setPriority = async (id, priority) => {
    try {
      console.log('Setting priority:', id, priority);
      await FirebaseService.setPriority(id, priority);
      
      // Update online status
      setIsOnline(FirebaseService.getOnlineStatus());
      
      // Update local state immediately
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === id ? { ...t, priority: priority } : t
        )
      );
      
    } catch (error) {
      console.error('Error setting priority:', error);
      setIsOnline(FirebaseService.getOnlineStatus());
      
      // Still update local state even if online update failed
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === id ? { ...t, priority: priority } : t
        )
      );
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    return true;
  });

  const completedCount = tasks.filter(task => task.completed).length;
  const totalCount = tasks.length;

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return ['#ef4444', '#ec4899'];
      case 'medium': return ['#f59e0b', '#f97316'];
      case 'low': return ['#10b981', '#14b8a6'];
      default: return ['#3b82f6', '#8b5cf6'];
    }
  };

  const theme = {
    background: darkMode 
      ? ['#0f172a', '#1e1b4b', '#312e81'] 
      : ['#dbeafe', '#ffffff', '#f3e8ff'],
    cardBg: darkMode ? '#1f2937' : '#ffffff',
    text: darkMode ? '#ffffff' : '#1f2937',
    textSecondary: darkMode ? '#9ca3af' : '#6b7280',
    border: darkMode ? '#374151' : '#e5e7eb',
    accent: ['#8b5cf6', '#ec4899'],
  };

  const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle={darkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={darkMode ? '#0f172a' : '#dbeafe'} 
      />
      
      <LinearGradient
        colors={theme.background}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Ionicons 
                name="sparkles" 
                size={32} 
                color={darkMode ? '#a855f7' : '#8b5cf6'} 
                style={styles.sparkleIcon}
              />
              <Text style={[styles.title, { color: theme.text }]}>
                Super Todo App
              </Text>
              <Ionicons 
                name="sparkles" 
                size={32} 
                color={darkMode ? '#a855f7' : '#8b5cf6'} 
                style={styles.sparkleIcon}
              />
            </View>
            
            {/* Status Indicator */}
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10b981' : '#ef4444' }]} />
              <Text style={[styles.statusText, { color: theme.textSecondary }]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
            
            <View style={styles.headerButtons}>
              <TouchableOpacity
                onPress={() => setDarkMode(!darkMode)}
                style={[
                  styles.themeToggle,
                  { backgroundColor: darkMode ? '#fbbf24' : '#1f2937' }
                ]}
              >
                <Ionicons 
                  name={darkMode ? 'sunny' : 'moon'} 
                  size={24} 
                  color={darkMode ? '#1f2937' : '#ffffff'} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={[styles.statCard, { backgroundColor: theme.cardBg }]}>
              <Text style={[styles.statNumber, { color: theme.text }]}>
                {totalCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Total Tasks
              </Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.cardBg }]}>
              <Text style={[styles.statNumber, { color: '#10b981' }]}>
                {completedCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Completed
              </Text>
            </View>
          </View>

          {/* Input Section */}
          <View style={[styles.inputContainer, { backgroundColor: theme.cardBg }]}>
            <TextInput
              style={[
                styles.textInput,
                { 
                  color: theme.text,
                  backgroundColor: darkMode ? '#374151' : '#f9fafb',
                  borderColor: theme.border
                }
              ]}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder="Ketik Disini"
              placeholderTextColor={theme.textSecondary}
              multiline
            />
            <TouchableOpacity onPress={addTask} style={styles.addButton} disabled={loading}>
              <LinearGradient
                colors={theme.accent}
                style={[styles.addButtonGradient, { opacity: loading ? 0.6 : 1 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name={loading ? "sync" : "add"} size={24} color="#ffffff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Filter Buttons */}
          <View style={styles.filterContainer}>
            {[
              { key: 'all', label: 'Semua' },
              { key: 'active', label: 'Aktif' },
              { key: 'completed', label: 'Selesai' }
            ].map((filterItem) => (
              <TouchableOpacity
                key={filterItem.key}
                onPress={() => setFilter(filterItem.key)}
                style={[
                  styles.filterButton,
                  {
                    backgroundColor: filter === filterItem.key 
                      ? theme.accent[0] 
                      : theme.cardBg
                  }
                ]}
              >
                <Text style={[
                  styles.filterText,
                  {
                    color: filter === filterItem.key 
                      ? '#ffffff' 
                      : theme.text
                  }
                ]}>
                  {filterItem.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tasks List */}
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {loading && (
              <View style={styles.loadingContainer}>
                <Ionicons name="sync" size={32} color={theme.textSecondary} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                  {!isAuthenticated ? 'Menginisialisasi...' : 'Memuat data...'}
                </Text>
              </View>
            )}
            {filteredTasks.map((task, index) => (
              <Animated.View
                key={task.id}
                style={[
                  styles.taskCard,
                  { 
                    backgroundColor: theme.cardBg,
                    borderColor: theme.border,
                    opacity: fadeAnim,
                  }
                ]}
              >
                <View style={styles.taskContent}>
                  {/* Complete Button */}
                  <TouchableOpacity
                    onPress={() => toggleTask(task.id)}
                    style={[
                      styles.completeButton,
                      {
                        backgroundColor: task.completed 
                          ? '#10b981' 
                          : 'transparent',
                        borderColor: task.completed 
                          ? '#10b981' 
                          : theme.border,
                      }
                    ]}
                  >
                    {task.completed && (
                      <Ionicons name="checkmark" size={16} color="#ffffff" />
                    )}
                  </TouchableOpacity>

                  {/* Task Text */}
                  <View style={styles.taskTextContainer}>
                    <Text style={[
                      styles.taskText,
                      {
                        color: task.completed 
                          ? theme.textSecondary 
                          : theme.text,
                        textDecorationLine: task.completed 
                          ? 'line-through' 
                          : 'none'
                      }
                    ]}>
                      {task.text}
                    </Text>
                  </View>

                  {/* Priority Indicator */}
                  <View style={styles.priorityContainer}>
                    <View
                      style={[
                        styles.priorityDot,
                        {
                          backgroundColor: getPriorityColor(task.priority)[0]
                        }
                      ]}
                    />
                  </View>

                  {/* Priority Buttons */}
                  <View style={styles.priorityButtons}>
                    {['high', 'medium', 'low'].map((priority) => (
                      <TouchableOpacity
                        key={priority}
                        onPress={() => setPriority(task.id, priority)}
                        style={[
                          styles.priorityButton,
                          {
                            backgroundColor: task.priority === priority
                              ? getPriorityColor(priority)[0]
                              : theme.border
                          }
                        ]}
                      />
                    ))}
                  </View>

                  {/* Delete Button */}
                  <TouchableOpacity
                    onPress={() => deleteTask(task.id)}
                    style={styles.deleteButton}
                  >
                    <Ionicons 
                      name="trash-outline" 
                      size={18} 
                      color={darkMode ? '#ef4444' : '#dc2626'} 
                    />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ))}
          </ScrollView>

          {/* Empty State */}
          {filteredTasks.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons 
                name="star-outline" 
                size={64} 
                color={theme.textSecondary} 
                style={styles.emptyIcon}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {filter === 'all' ? 'Belum ada task nih!' : 
                 filter === 'active' ? 'Semua task sudah selesai!' : 
                 'Belum ada task yang selesai!'}
              </Text>
            </View>
          )}
        </Animated.View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginHorizontal: 15,
  },
  sparkleIcon: {
    opacity: 0.8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  themeToggle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 20,
    marginHorizontal: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    alignItems: 'flex-end',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  textInput: {
    flex: 1,
    minHeight: 50,
    maxHeight: 100,
    borderWidth: 2,
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginRight: 10,
  },
  addButton: {
    width: 50,
    height: 50,
    borderRadius: 15,
    overflow: 'hidden',
  },
  addButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 15,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  taskCard: {
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  taskContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  taskTextContainer: {
    flex: 1,
  },
  taskText: {
    fontSize: 16,
    fontWeight: '500',
  },
  priorityContainer: {
    marginRight: 10,
  },
  priorityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  priorityButtons: {
    flexDirection: 'column',
    marginRight: 10,
  },
  priorityButton: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginVertical: 1,
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
});

export default SuperCoolTodoApp;