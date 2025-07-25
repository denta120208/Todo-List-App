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
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FirebaseService from './firebaseService-mobile';
import NotificationService from './notificationService';


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
  
  // Alarm/Notification states
  const [showAlarmModal, setShowAlarmModal] = useState(false);
  const [alarmDate, setAlarmDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [hasAlarm, setHasAlarm] = useState(false);
  
  // Daily reminder states
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderTime, setReminderTime] = useState(new Date());
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderSound, setReminderSound] = useState('default');
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  
  // Task alarm confirmation states
  const [showTaskAlarmConfirm, setShowTaskAlarmConfirm] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [currentTaskText, setCurrentTaskText] = useState('');

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

    // Initialize Firebase and notifications
    initializeApp();

    // Initialize notifications
    NotificationService.initialize();

    // Load reminder settings
    loadReminderSettings();

    // Set up notification listeners
    const removeNotificationListeners = NotificationService.setupListeners(
      (notification) => {
        // Handle notification received while app is open
        console.log('Notification received in app:', notification.request.content.body);
      },
      (response) => {
        // Handle user interaction with notification
        const taskId = response.notification.request.content.data?.taskId;
        if (taskId) {
          console.log('User tapped notification for task:', taskId);
          // You can add logic here to highlight the task or navigate to it
        }
      }
    );

    // Cleanup listener on unmount
    return () => {
      if (window.unsubscribeTasks) {
        window.unsubscribeTasks();
      }
      removeNotificationListeners();
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
      
      // Different approach for mobile vs web
      if (Platform.OS === 'web') {
        // Web: Use real-time listener
        const unsubscribe = FirebaseService.subscribeToTasks((tasksFromFirestore) => {
          setTasks(tasksFromFirestore);
          setIsOnline(FirebaseService.getOnlineStatus());
          setLoading(false);
        });
        
        // Store unsubscribe function for cleanup
        window.unsubscribeTasks = unsubscribe;
      } else {
        // Mobile: Use manual refresh (no real-time listener)
        console.log('Mobile detected - using manual refresh mode');
        window.unsubscribeTasks = () => {}; // Empty function for cleanup
      }
      
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
      if (Platform.OS !== 'web') {
        setLoading(true);
      }
      const tasksFromFirestore = await FirebaseService.getTasks();
      setTasks(tasksFromFirestore);
      setIsOnline(FirebaseService.getOnlineStatus());
      console.log('Tasks loaded:', tasksFromFirestore.length);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setIsOnline(FirebaseService.getOnlineStatus());
      if (Platform.OS !== 'web') {
        console.log('Load failed, tasks will be empty or from cache');
      }
    } finally {
      if (Platform.OS !== 'web') {
        setLoading(false);
      }
    }
  };

  // Load reminder settings from storage
  const loadReminderSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('reminder_settings');
      if (settings) {
        const { enabled, time, sound } = JSON.parse(settings);
        setReminderEnabled(enabled);
        setReminderTime(new Date(time));
        setReminderSound(sound);
        
        // Re-schedule reminder if it was enabled
        if (enabled) {
          const timeObj = new Date(time);
          await NotificationService.scheduleDailyReminder(
            timeObj.getHours(), 
            timeObj.getMinutes(), 
            sound
          );
        }
      }
    } catch (error) {
      console.error('Error loading reminder settings:', error);
    }
  };

  // Save reminder settings to storage
  const saveReminderSettings = async (enabled, time, sound) => {
    try {
      const settings = {
        enabled,
        time: time.toISOString(),
        sound
      };
      await AsyncStorage.setItem('reminder_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving reminder settings:', error);
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
        alarmTime: null,
        notificationId: null,
      };
      
      console.log('Adding task:', newTask);
      const taskId = await FirebaseService.addTask(newTask);
      
      console.log('Task added successfully');
      const taskText = inputValue.trim();
      setInputValue('');
      
      // Update online status
      setIsOnline(FirebaseService.getOnlineStatus());
      
      // For mobile, manually refresh tasks
      if (Platform.OS !== 'web') {
        await loadTasks();
      }
      
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
      
      // Show alarm confirmation after task is added
      setCurrentTaskId(taskId);
      setCurrentTaskText(taskText);
      setShowTaskAlarmConfirm(true);
      
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
        
        // Update local state immediately for better UX
        setTasks(prevTasks => 
          prevTasks.map(t => 
            t.id === id ? { ...t, completed: !t.completed } : t
          )
        );
        
        // Then update Firebase
        await FirebaseService.toggleTask(id, task.completed);
        
        // Update online status
        setIsOnline(FirebaseService.getOnlineStatus());
        
        // For mobile, refresh tasks to ensure consistency
        if (Platform.OS !== 'web') {
          setTimeout(() => loadTasks(), 500);
        }
      }
    } catch (error) {
      console.error('Error toggling task:', error);
      setIsOnline(FirebaseService.getOnlineStatus());
      
      // Keep the local state change even if Firebase update failed
      console.log('Toggle saved locally');
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
                
                // Cancel notification if exists
                const task = tasks.find(t => t.id === id);
                if (task?.notificationId) {
                  await NotificationService.cancelTaskNotification(task.notificationId);
                }
                
                // Update local state immediately
                setTasks(prevTasks => prevTasks.filter(t => t.id !== id));
                
                // Then update Firebase
                await FirebaseService.deleteTask(id);
                
                // Update online status
                setIsOnline(FirebaseService.getOnlineStatus());
                
                // For mobile, refresh tasks to ensure consistency
                if (Platform.OS !== 'web') {
                  setTimeout(() => loadTasks(), 500);
                }
                
              } catch (error) {
                console.error('Error deleting task:', error);
                setIsOnline(FirebaseService.getOnlineStatus());
                
                // Keep the local state change even if Firebase delete failed
                console.log('Delete saved locally');
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
      
      // Update local state immediately
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === id ? { ...t, priority: priority } : t
        )
      );
      
      // Then update Firebase
      await FirebaseService.setPriority(id, priority);
      
      // Update online status
      setIsOnline(FirebaseService.getOnlineStatus());
      
      // For mobile, refresh tasks to ensure consistency
      if (Platform.OS !== 'web') {
        setTimeout(() => loadTasks(), 500);
      }
      
    } catch (error) {
      console.error('Error setting priority:', error);
      setIsOnline(FirebaseService.getOnlineStatus());
      
      // Keep the local state change even if Firebase update failed
      console.log('Priority change saved locally');
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
                onPress={() => setShowReminderModal(true)}
                style={[
                  styles.reminderButton,
                  { backgroundColor: reminderEnabled ? theme.accent[0] : theme.border }
                ]}
              >
                <Ionicons 
                  name="notifications-outline" 
                  size={20} 
                  color={reminderEnabled ? '#ffffff' : theme.textSecondary} 
                />
              </TouchableOpacity>
              
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
                    {task.alarmTime && (
                      <View style={styles.alarmTimeContainer}>
                        <Ionicons name="alarm-outline" size={12} color={theme.textSecondary} />
                        <Text style={[styles.alarmTimeText, { color: theme.textSecondary }]}>
                          {NotificationService.formatAlarmTime(task.alarmTime)}
                        </Text>
                      </View>
                    )}
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

      {/* Alarm Modal */}
      <Modal
        visible={showAlarmModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAlarmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Set Alarm untuk Task
            </Text>

            {hasAlarm && (
              <Text style={[styles.selectedTimeText, { color: theme.textSecondary }]}>
                Alarm: {NotificationService.formatAlarmTime(alarmDate)}
              </Text>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={[styles.modalButton, { backgroundColor: theme.accent[0] }]}
              >
                <Ionicons name="calendar-outline" size={20} color="#ffffff" />
                <Text style={styles.modalButtonText}>Pilih Tanggal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowTimePicker(true)}
                style={[styles.modalButton, { backgroundColor: theme.accent[1] }]}
              >
                <Ionicons name="time-outline" size={20} color="#ffffff" />
                <Text style={styles.modalButtonText}>Pilih Waktu</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setHasAlarm(false);
                  setShowAlarmModal(false);
                }}
                style={[styles.actionButton, { backgroundColor: theme.border }]}
              >
                <Text style={[styles.actionButtonText, { color: theme.text }]}>
                  Hapus Alarm
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  if (currentTaskId && NotificationService.isValidAlarmTime(alarmDate)) {
                    // Schedule notification for existing task
                    const notificationId = await NotificationService.scheduleTaskNotification(
                      { id: currentTaskId, text: currentTaskText }, 
                      alarmDate
                    );
                    
                    if (notificationId) {
                      // Update task with alarm time and notification ID
                      await FirebaseService.updateTaskAlarm(currentTaskId, alarmDate.toISOString(), notificationId);
                      
                      // Refresh tasks
                      if (Platform.OS !== 'web') {
                        await loadTasks();
                      }
                      
                      Alert.alert(
                        'Alarm Diatur!', 
                        `Alarm untuk "${currentTaskText}" akan berbunyi pada ${alarmDate.toLocaleDateString('id-ID')} jam ${alarmDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                      );
                    }
                  }
                  
                  setHasAlarm(false);
                  setShowAlarmModal(false);
                  setCurrentTaskId(null);
                  setCurrentTaskText('');
                }}
                style={[styles.actionButton, { backgroundColor: theme.accent[0] }]}
              >
                <Text style={styles.actionButtonText}>Set Alarm</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowAlarmModal(false)}
                style={[styles.actionButton, { backgroundColor: theme.border }]}
              >
                <Text style={[styles.actionButtonText, { color: theme.text }]}>
                  Batal
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={alarmDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                const newDate = new Date(alarmDate);
                newDate.setFullYear(selectedDate.getFullYear());
                newDate.setMonth(selectedDate.getMonth());
                newDate.setDate(selectedDate.getDate());
                setAlarmDate(newDate);
              }
            }}
          />
        )}

        {/* Time Picker */}
        {showTimePicker && (
          <DateTimePicker
            value={alarmDate}
            mode="time"
            display="default"
            onChange={(event, selectedTime) => {
              setShowTimePicker(false);
              if (selectedTime) {
                const newDate = new Date(alarmDate);
                newDate.setHours(selectedTime.getHours());
                newDate.setMinutes(selectedTime.getMinutes());
                setAlarmDate(newDate);
              }
            }}
          />
        )}
      </Modal>

      {/* Daily Reminder Modal */}
      <Modal
        visible={showReminderModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReminderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Daily Reminder
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Atur waktu notifikasi harian untuk mengingatkan check todo list
            </Text>

            {reminderEnabled && (
              <Text style={[styles.selectedTimeText, { color: theme.textSecondary }]}>
                Reminder aktif: {reminderTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}

            <View style={styles.modalSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Waktu Reminder</Text>
              <TouchableOpacity
                onPress={() => setShowReminderTimePicker(true)}
                style={[styles.timePickerButton, { backgroundColor: theme.accent[0] }]}
              >
                <Ionicons name="time-outline" size={20} color="#ffffff" />
                <Text style={styles.timePickerButtonText}>
                  {reminderTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Nada Dering</Text>
              <View style={styles.soundOptions}>
                {[
                  { value: 'default', label: 'Default' },
                  { value: 'bell', label: 'Bell' },
                  { value: 'chime', label: 'Chime' },
                  { value: 'alarm', label: 'Alarm' }
                ].map((sound) => (
                  <TouchableOpacity
                    key={sound.value}
                    onPress={() => setReminderSound(sound.value)}
                    style={[
                      styles.soundOption,
                      {
                        backgroundColor: reminderSound === sound.value 
                          ? theme.accent[0] 
                          : theme.border
                      }
                    ]}
                  >
                    <Text style={[
                      styles.soundOptionText,
                      {
                        color: reminderSound === sound.value 
                          ? '#ffffff' 
                          : theme.text
                      }
                    ]}>
                      {sound.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={async () => {
                  if (reminderEnabled) {
                    await NotificationService.cancelDailyReminder();
                    setReminderEnabled(false);
                    await saveReminderSettings(false, reminderTime, reminderSound);
                  }
                  setShowReminderModal(false);
                }}
                style={[styles.actionButton, { backgroundColor: '#ef4444' }]}
              >
                <Text style={styles.actionButtonText}>Matikan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  const hour = reminderTime.getHours();
                  const minute = reminderTime.getMinutes();
                  
                  await NotificationService.scheduleDailyReminder(hour, minute, reminderSound);
                  setReminderEnabled(true);
                  await saveReminderSettings(true, reminderTime, reminderSound);
                  setShowReminderModal(false);
                  
                  Alert.alert(
                    'Reminder Diatur!', 
                    `Notifikasi harian akan muncul setiap hari jam ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
                  );
                }}
                style={[styles.actionButton, { backgroundColor: theme.accent[0] }]}
              >
                <Text style={styles.actionButtonText}>Aktifkan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowReminderModal(false)}
                style={[styles.actionButton, { backgroundColor: theme.border }]}
              >
                <Text style={[styles.actionButtonText, { color: theme.text }]}>
                  Batal
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Reminder Time Picker */}
        {showReminderTimePicker && (
          <DateTimePicker
            value={reminderTime}
            mode="time"
            display="default"
            onChange={(event, selectedTime) => {
              setShowReminderTimePicker(false);
              if (selectedTime) {
                setReminderTime(selectedTime);
              }
            }}
          />
        )}
      </Modal>

      {/* Task Alarm Confirmation Modal */}
      <Modal
        visible={showTaskAlarmConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTaskAlarmConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <Ionicons 
              name="alarm-outline" 
              size={48} 
              color={theme.accent[0]} 
              style={{ marginBottom: 20 }}
            />
            
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Set Alarm untuk Task?
            </Text>
            
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              "{currentTaskText}"
            </Text>
            
            <Text style={[styles.taskAlarmDescription, { color: theme.textSecondary }]}>
              Ingin mengatur alarm dengan tanggal dan waktu tertentu untuk task ini?
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setShowTaskAlarmConfirm(false);
                  // Reset alarm date to current time + 1 hour
                  const futureTime = new Date();
                  futureTime.setHours(futureTime.getHours() + 1);
                  setAlarmDate(futureTime);
                  setHasAlarm(true);
                  setShowAlarmModal(true);
                }}
                style={[styles.actionButton, { backgroundColor: theme.accent[0] }]}
              >
                <Text style={styles.actionButtonText}>Ya, Set Alarm</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowTaskAlarmConfirm(false);
                  setCurrentTaskId(null);
                  setCurrentTaskText('');
                }}
                style={[styles.actionButton, { backgroundColor: theme.border }]}
              >
                <Text style={[styles.actionButtonText, { color: theme.text }]}>
                  Tidak, Terima Kasih
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  reminderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
  alarmButton: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
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
  alarmTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  alarmTimeText: {
    fontSize: 12,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    margin: 20,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 300,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  selectedTimeText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  modalButton: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 15,
    alignItems: 'center',
    gap: 8,
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 15,
    minWidth: 80,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Reminder modal styles
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalSection: {
    width: '100%',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  timePickerButton: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  timePickerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  soundOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  soundOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  soundOptionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  taskAlarmDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
});

export default SuperCoolTodoApp;