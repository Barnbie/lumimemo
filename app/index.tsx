import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ImageBackground,
  TouchableOpacity, TextInput, FlatList, Dimensions, Image, Share, Linking, Platform, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable } from 'react-native';
import { useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdBanner from '../components/AdBanner'; 





const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 columns with padding

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
  timestamp: number;
}

const THEME = {
  dark: {
    background: require('../assets/dark-background.png'),
    containerBg: '#2a2a2a',
    cardBorder: '#ffffff',
    text: '#ffffff',
    textSecondary: '#C1C1C1',
    searchBorder: '#ffffff',
    menuBg: '#373737ff',
    defaultCardColor: '#373737ff',
    modalBg: '#2a2a2a',
    deleteButtonBg: '#ffffff2b',
    actionIconBg: 'transparent',
  },
  light: {
    background: require('../assets/light-background.png'),
    containerBg: '#D9D9D9',
    cardBorder: '#000000',
    text: '#000000',
    textSecondary: '#666666',
    searchBorder: '#000000',
    menuBg: '#D9D9D9',
    defaultCardColor: '#D9D9D9', // ← Your light gray
    modalBg: '#D9D9D9',
    deleteButtonBg: '#D9D9D9',
    actionIconBg: '#D9D9D9',
  },
};


export default function NotesListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [menuVisible, setMenuVisible] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [longPressedNote, setLongPressedNote] = useState<Note | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true); // Default to dark mode
  const startX = useRef(0);
  const isSwiping = useRef(false);
  const currentTheme = isDarkMode ? THEME.dark : THEME.light;
  console.log('isDarkMode:', isDarkMode);
console.log('currentTheme:', currentTheme);
console.log('notes:', notes);
  const NOTE_COLORS = [
  '#0024CA',
  '#01A516',
  '#FF7318',
  '#9612E4',
  '#FF017A',
  '#D90303',
];

// ← ADD THE stripHtmlTags FUNCTION HERE
const parseHtmlContent = (html: string) => {
  if (!html) return [];
  
  const items: Array<{type: 'text' | 'checkbox' | 'bullet' | 'number', content: string, checked?: boolean, number?: number, position: number}> = [];
  
  // FIXED: Match each checkbox div individually with its checked state
  const checkboxRegex = /<div class="checkbox-line">([\s\S]*?)<\/div>/g;
  let match;
  
  while ((match = checkboxRegex.exec(html)) !== null) {
    const checkboxHtml = match[1];
    
    // Check if the input has 'checked' attribute
    const isChecked = checkboxHtml.includes('checked');
    
    // Extract text from the checkbox-text span
    const textMatch = checkboxHtml.match(/<span class="checkbox-text"[^>]*>([\s\S]*?)<\/span>/);
    const content = textMatch 
      ? textMatch[1].replace(/<[^>]*>/g, '').replace(/&#8203;/g, '').trim()
      : checkboxHtml.replace(/<[^>]*>/g, '').replace(/&#8203;/g, '').trim();
    
    if (content) {
      items.push({ 
        type: 'checkbox', 
        content, 
        checked: isChecked, 
        position: match.index! 
      });
    }
  }
  
  // Process bullet lists
  const ulRegex = /<ul>([\s\S]*?)<\/ul>/g;
  while ((match = ulRegex.exec(html)) !== null) {
    const liMatches = match[1].matchAll(/<li>(.*?)<\/li>/gs);
    for (const li of liMatches) {
      const content = li[1].replace(/<[^>]*>/g, '').replace(/&#8203;/g, '').trim();
      if (content) {
        items.push({ type: 'bullet', content, position: match.index! });
      }
    }
  }
  
  // Process numbered lists
  const olRegex = /<ol>([\s\S]*?)<\/ol>/g;
  let numberCounter = 1;
  while ((match = olRegex.exec(html)) !== null) {
    const liMatches = match[1].matchAll(/<li>(.*?)<\/li>/gs);
    for (const li of liMatches) {
      const content = li[1].replace(/<[^>]*>/g, '').replace(/&#8203;/g, '').trim();
      if (content) {
        items.push({ type: 'number', content, number: numberCounter++, position: match.index! });
      }
    }
  }
  
  // Sort by position to maintain order
  items.sort((a, b) => a.position - b.position);
  
  // If no lists found, return plain text
  if (items.length === 0) {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/&#8203;/g, '').replace(/\s+/g, ' ').trim();
    if (text) {
      items.push({ type: 'text', content: text, position: 0 });
    }
  }
  
  return items;
};



  useEffect(() => {
  loadTheme();
  loadViewMode();
}, []);

useEffect(() => {
  if (isDarkMode !== null) {
    loadNotes();
  }
}, [isDarkMode]);


  const loadNotes = async () => {
  try {
    const savedNotes = await AsyncStorage.getItem('notes');
    if (savedNotes) {
      const parsedNotes: Note[] = JSON.parse(savedNotes);

      // ADD THIS DEBUG LOG
      console.log('=== LOADED NOTES ===');
      parsedNotes.forEach((note, i) => {
        console.log(`Note ${i}:`, note.title);
        console.log('Content preview:', note.content.substring(0, 200));
        console.log('Has checked:', note.content.includes('checked'));
      });

      const fixedNotes = parsedNotes.map(note => ({
        ...note,
        color: note.color || (isDarkMode ? '#373737ff' : '#D9D9D9'),
      }));

      setNotes(fixedNotes);
      await AsyncStorage.setItem('notes', JSON.stringify(fixedNotes));
    } else {
      createSampleNote();
    }
  } catch (error) {
    console.error('Error loading notes:', error);
    createSampleNote();
  }
};

  const createSampleNote = async () => {
    const sampleNote: Note = {
      id: Date.now().toString(),
      title: 'Sample Notes',
      content: 'Click on the plus sign to add new note. Swipe card left or right to change color. Long press card to preview.',
      color: currentTheme.defaultCardColor,
      isPinned: false,
      timestamp: Date.now(),
    };
    
    const newNotes = [sampleNote];
    setNotes(newNotes);
    await AsyncStorage.setItem('notes', JSON.stringify(newNotes));
  };

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const loadViewMode = async () => {
  try {
    const savedViewMode = await AsyncStorage.getItem('viewMode');
    if (savedViewMode !== null) {
      setViewMode(savedViewMode as 'grid' | 'list');
    }
  } catch (error) {
    console.error('Error loading view mode:', error);
  }
};

  const changeNoteColor = async (noteId: string, direction: 'left' | 'right') => {
  const updatedNotes = notes.map(note => {
    if (note.id !== noteId) return note;

    // Include default color in the array
    const defaultColor = isDarkMode ? '#373737ff' : '#D9D9D9';
    const allColors = [defaultColor, ...NOTE_COLORS];
    
    const currentIndex = allColors.indexOf(note.color);
    const nextIndex =
      direction === 'right'
        ? (currentIndex + 1) % allColors.length
        : (currentIndex - 1 + allColors.length) % allColors.length;

    return { ...note, color: allColors[nextIndex] };
  });

  setNotes(updatedNotes);
  await AsyncStorage.setItem('notes', JSON.stringify(updatedNotes));
};


  const createNewNote = () => {
    router.push('/note/new');
  };

  const openNote = (noteId: string) => {
  if (isSelectMode) {
    // In select mode, clicking a card toggles selection
    toggleNoteSelection(noteId);
  } else {
    // Normal mode, open the note
    router.push(`/note/${noteId}`);
  }
};

  const renderNoteCard = ({ item }: { item: Note }) => {
  const isSelected = selectedNotes.includes(item.id);

  return (
    <Pressable
      onPress={() => {
        if (!isSwiping.current) {
          openNote(item.id);
        }
      }}
      onLongPress={() => {
        if (!isSelectMode) {
          handleLongPress(item);
        }
      }}
      onPressIn={(e) => {
        startX.current = e.nativeEvent.pageX;
        isSwiping.current = false;
      }}
      onPressOut={(e) => {
        const diff = e.nativeEvent.pageX - startX.current;
        if (Math.abs(diff) > 10) {
          isSwiping.current = true;
        }
      }}
      onTouchEnd={(e) => {
        const diff = e.nativeEvent.pageX - startX.current;

        if (!isSelectMode) {
          if (diff > 50) {
            changeNoteColor(item.id, 'right');
          } else if (diff < -50) {
            changeNoteColor(item.id, 'left');
          }
        }

        setTimeout(() => {
          isSwiping.current = false;
        }, 0);
      }}
      style={[
        viewMode === 'grid' ? styles.gridCard : styles.listCard,
        { backgroundColor: item.color || NOTE_COLORS[0] },
        isSelected && styles.selectedCard,
      ]}
    >
      {item.isPinned && (
  <View style={styles.pinIcon}>
    <Image
      source={require('../assets/pin.png')}
      style={styles.pinIconImage}
      resizeMode="contain"
    />
  </View>
)}

  <Text style={[styles.cardTitle, { 
  color: isDarkMode ? '#ffffff' : '#000000'
}]} numberOfLines={1}>
  {item.title || 'Untitled'}
</Text>

<View style={{ flex: 1, marginTop: 4 }}>
  {parseHtmlContent(item.content).slice(0, 3).map((listItem, index) => (
    <View key={index} style={{ flexDirection: 'row', marginBottom: 4 }}>
      <Text 
        style={[styles.cardContent, { 
          color: isDarkMode ? '#C1C1C1' : '#1E1E1E',
          flex: 1
        }]}
        numberOfLines={1}
      >
        {listItem.type === 'checkbox' && (listItem.checked ? '☑ ' : '☐ ')}
        {listItem.type === 'bullet' && '• '}
        {listItem.type === 'number' && `${listItem.number}. `}
        {listItem.content}
      </Text>
    </View>
  ))}
</View>

      <View style={styles.cardFooter}>
        <Text style={[styles.timestamp, { 
  color: isDarkMode ? '#C1C1C1' : '#1E1E1E'
}]}>
          {getTimeAgo(item.timestamp)}
        </Text>

        {isSelectMode && (
          <TouchableOpacity
            style={[
              styles.checkbox,
              isSelected && styles.checkboxSelected,
            ]}
            onPress={() => toggleNoteSelection(item.id)}
          >
            {isSelected && (
              <View style={styles.checkboxInner} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </Pressable>
  );
};


  const getTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Filter notes based on search query
const getFilteredNotes = () => {
  if (!searchQuery.trim()) {
    return notes; // Return all notes if search is empty
  }

  const query = searchQuery.toLowerCase().trim();
  
  return notes.filter(note => {
    const titleMatch = note.title?.toLowerCase().includes(query);
    const contentMatch = note.content?.toLowerCase().includes(query);
    return titleMatch || contentMatch;
  });
};

  // Toggle select mode
const toggleSelectMode = () => {
  setIsSelectMode(!isSelectMode);
  setSelectedNotes([]);
  setMenuVisible(false);
};

// Toggle note selection
const toggleNoteSelection = (noteId: string) => {
  if (selectedNotes.includes(noteId)) {
    setSelectedNotes(selectedNotes.filter(id => id !== noteId));
  } else {
    setSelectedNotes([...selectedNotes, noteId]);
  }
};

/// Show delete confirmation for selected notes
const confirmDeleteSelected = () => {
  setShowDeleteConfirmation(true);
};

// Delete selected notes after confirmation
const deleteSelectedNotes = async () => {
  const remainingNotes = notes.filter(note => !selectedNotes.includes(note.id));
  setNotes(remainingNotes);
  await AsyncStorage.setItem('notes', JSON.stringify(remainingNotes));
  setSelectedNotes([]);
  setIsSelectMode(false);
  setShowDeleteConfirmation(false);
};



// Long press handler
const handleLongPress = (note: Note) => {
  setLongPressedNote(note);
};

// Pin note
const togglePin = async (noteId: string) => {
  const updatedNotes = notes.map(note =>
    note.id === noteId ? { ...note, isPinned: !note.isPinned } : note
  );
  setNotes(updatedNotes);
  await AsyncStorage.setItem('notes', JSON.stringify(updatedNotes));
  setLongPressedNote(null);
};

// Duplicate note
const duplicateNote = async (note: Note) => {
  const newNote: Note = {
    ...note,
    id: Date.now().toString(),
    title: note.title + ' (Copy)',
    timestamp: Date.now(),
  };
  const updatedNotes = [newNote, ...notes];
  setNotes(updatedNotes);
  await AsyncStorage.setItem('notes', JSON.stringify(updatedNotes));
  setLongPressedNote(null);
};

// Delete single note (ADD THIS - for long press modal)
const deleteNote = async (noteId: string) => {
  const updatedNotes = notes.filter(note => note.id !== noteId);
  setNotes(updatedNotes);
  await AsyncStorage.setItem('notes', JSON.stringify(updatedNotes));
  setNoteToDelete(null);
  setLongPressedNote(null);
};

const toggleTheme = async () => {
  const newTheme = !isDarkMode;
  const darkDefault = '#373737ff';
  const lightDefault = '#D9D9D9';
  
  // First update the theme state
  setIsDarkMode(newTheme);
  await AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
  
  // Then update all notes with default colors
  setTimeout(async () => {
    const updatedNotes = notes.map(note => {
      if (newTheme && note.color === lightDefault) {
        return { ...note, color: darkDefault };
      } else if (!newTheme && note.color === darkDefault) {
        return { ...note, color: lightDefault };
      }
      return note;
    });
    
    setNotes(updatedNotes);
    await AsyncStorage.setItem('notes', JSON.stringify(updatedNotes));
  }, 100);
  
  setMenuVisible(false);
};

// Share a single note
const shareNote = async (note: Note) => {
  try {
    const message = `${note.title}\n\n${note.content}`;
    
    await Share.share({
      message: message,
      title: note.title || 'My Note',
    });
    
    setLongPressedNote(null);
  } catch (error) {
    console.error('Error sharing note:', error);
  }
};

// Share the app
const shareApp = async () => {
  try {
    await Share.share({
      message: 'Check out LumiMemo - A beautiful simple note-taking app. Download it now!',
      title: 'LumiNote App',
    });
  } catch (error) {
    console.error('Error sharing app:', error);
  }
};

// Show rate app modal
const rateApp = () => {
  setShowRateModal(true);
  setMenuVisible(false);
};

// Open app store for rating
const openAppStore = async () => {
  try {
    const { Linking, Platform } = require('react-native');
    
    const appStoreUrl = Platform.OS === 'ios' 
      ? 'https://apps.apple.com/app/idYOUR_APP_ID' // Replace with your App Store ID
      : 'https://play.google.com/store/apps/details?id=YOUR_PACKAGE_NAME'; // Replace with your package name
    
    const canOpen = await Linking.canOpenURL(appStoreUrl);
    if (canOpen) {
      await Linking.openURL(appStoreUrl);
    }
    
    setShowRateModal(false);
  } catch (error) {
    console.error('Error opening app store:', error);
    setShowRateModal(false);
  }
};

// Show nothing while loading theme
// if (isDarkMode === null) {
//   return null;
// }

return (
  <View style={styles.container}>
    <StatusBar 
      barStyle={isDarkMode ? "light-content" : "dark-content"}
      backgroundColor={isDarkMode ? "#000" : "#fff"}
      translucent={true}
    />
    <ImageBackground
        source={isDarkMode 
          ? require('../assets/dark-background.png')
          : require('../assets/light-background.png')
        }
      style={StyleSheet.absoluteFillObject}
      resizeMode="cover"
    >
      {/* Header Row */}
      <View style={[styles.headerRow, { paddingTop: insets.top + 10 }]}>
        {/* App Name - Left */}
        <Text style={[styles.headerTitle, { color: currentTheme.text }]}>LumiMemo</Text>
        
        {/* Search Bar - Center */}
        <View style={[styles.searchContainer, { borderColor: currentTheme.searchBorder }]}>
  <Image
      source={require('../assets/search.png')}
      style={[styles.searchIcon, { tintColor: isDarkMode ? '#aaa' : '#666' }]}
      resizeMode="contain"
 />

  <TextInput
    style={[styles.searchInput, { color: currentTheme.text }]}
    placeholder="Search notes..."
    placeholderTextColor={isDarkMode ? '#666' : '#999'}
    value={searchQuery}
    onChangeText={setSearchQuery}
  />
</View>

        {/* Menu Icon - Right */}
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => setMenuVisible(!menuVisible)}
        >
          <Text style={[styles.menuIcon, { color: currentTheme.text }]}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* Select Mode Header */}
{isSelectMode && (
  <View style={[styles.selectModeHeader, { backgroundColor: currentTheme.modalBg }]}>
    <TouchableOpacity onPress={toggleSelectMode}>
      <Text style={[styles.cancelText, { color: currentTheme.text }]}>✕ Cancel</Text>
    </TouchableOpacity>
    <Text style={styles.selectedCountText}>
      {selectedNotes.length} selected
    </Text>
  </View>
)}

      {/* Notes List */}
      <FlatList
  data={getFilteredNotes()}  // ← Changed from notes to getFilteredNotes()
  renderItem={renderNoteCard}
  keyExtractor={(item) => item.id}
  numColumns={viewMode === 'grid' ? 2 : 1}
  key={viewMode}
  contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 120 }]}
  showsVerticalScrollIndicator={false}
  ListEmptyComponent={
    searchQuery.trim() ? (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No notes found</Text>
        <Text style={styles.emptySubText}>Try a different search term</Text>
      </View>
    ) : null
  }
/>

     {/* FAB Button or Delete All Button */}
{!isSelectMode ? (
  <TouchableOpacity 
    style={[styles.fab, { bottom: insets.bottom + 30 }]}
    onPress={createNewNote}
    activeOpacity={0.8}
  >
    <Text style={styles.fabText}>+</Text>
  </TouchableOpacity>
) : selectedNotes.length > 0 ? (
  <TouchableOpacity 
    style={[styles.deleteAllButton, { backgroundColor: currentTheme.deleteButtonBg }]}
    onPress={confirmDeleteSelected}
    activeOpacity={0.8}
  >
    <Text style={[styles.deleteAllText, { color: currentTheme.text }]}>Delete All</Text>
  </TouchableOpacity>
) : null}

      {/* Menu Dropdown */}
{menuVisible && (
  <TouchableOpacity 
    style={styles.menuOverlay}
    activeOpacity={1}
    onPress={() => setMenuVisible(false)}
  >
    <View 
     style={[styles.menuDropdown, { backgroundColor: currentTheme.menuBg }]}
     onStartShouldSetResponder={() => true}
    >
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={toggleSelectMode}
      >
        <Text style={[styles.menuItemText, { color: currentTheme.text }]}>Select Notes</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
  style={styles.menuItem}
  onPress={async () => {
    const newViewMode = viewMode === 'grid' ? 'list' : 'grid';
    setViewMode(newViewMode);
    await AsyncStorage.setItem('viewMode', newViewMode);
    setMenuVisible(false);
  }}
>
        <Text style={[styles.menuItemText, { color: currentTheme.text }]}>
          {viewMode === 'grid' ? 'List View' : 'Grid View'}
        </Text>
      </TouchableOpacity>
      
      
      <TouchableOpacity 
  style={styles.menuItem}
  onPress={toggleTheme}
>
  <Text style={[styles.menuItemText, { color: currentTheme.text }]}>
    {isDarkMode ? 'Light Mode' : 'Dark Mode'}
  </Text>
</TouchableOpacity>
      
      
      <TouchableOpacity 
  style={styles.menuItem}
  onPress={() => {
    shareApp();
    setMenuVisible(false);
  }}
>
  <Text style={[styles.menuItemText, { color: currentTheme.text }]}>Share</Text>
</TouchableOpacity>
      
      
     <TouchableOpacity 
  style={styles.menuItem}
  onPress={() => {
    rateApp();
    setMenuVisible(false);
  }}
>
  <Text style={[styles.menuItemText, { color: currentTheme.text }]}>Rate App</Text>
</TouchableOpacity>
      <TouchableOpacity 
  style={styles.menuItem}
  onPress={async () => {
    await AsyncStorage.clear();
    createSampleNote();
    setMenuVisible(false);
  }}
>
  <Text style={[styles.menuItemText, { color: currentTheme.text }]}>Reset App</Text>
</TouchableOpacity>
    </View>
  </TouchableOpacity>
)}

{/* Long Press Modal */}
{longPressedNote && (
  <View style={styles.modalOverlay}>
    <TouchableOpacity 
      style={styles.modalBackground}
      activeOpacity={1}
      onPress={() => setLongPressedNote(null)}
    />
    
    <View style={styles.enlargedCard}>
  <View 
    style={[
      styles.enlargedCardContent,
      { 
        backgroundColor: longPressedNote.color,
        borderColor: currentTheme.cardBorder,
      }
    ]}
  >
        {longPressedNote.isPinned && (
  <View style={styles.pinIconLarge}>
    <Image
      source={require('../assets/pin.png')}
      style={styles.pinIconImageLarge}
      resizeMode="contain"
    />
  </View>
)}

<Text style={[styles.enlargedTitle, { 
  color: isDarkMode ? '#ffffff' : '#000000'
}]}>
  {longPressedNote.title || 'Untitled'}
</Text>

<View>
  {parseHtmlContent(longPressedNote.content).map((listItem, index) => (
    <Text 
      key={index} 
      style={[styles.enlargedContent, { 
        color: isDarkMode ? '#E0E0E0' : '#1E1E1E',
        marginBottom: 6
      }]}
    >
      {listItem.type === 'checkbox' && (listItem.checked ? '☑ ' : '☐ ')}
      {listItem.type === 'bullet' && '• '}
      {listItem.type === 'number' && `${listItem.number}. `}
      {listItem.content}
    </Text>
  ))}
</View>
      </View>

      {/* Action Buttons - KEEP THESE INSIDE */}
      {/* Action Buttons */}
<View style={[styles.actionButtons, { 
  backgroundColor: currentTheme.modalBg,
  borderColor: currentTheme.cardBorder,
}]}>
        <TouchableOpacity 
  style={styles.actionButton}
  onPress={() => shareNote(longPressedNote)}
>
          <View style={[styles.actionIcon, { backgroundColor: currentTheme.actionIconBg }]}>
            <Image
              source={require('../assets/share.png')}
              style={[styles.actionIconImage, { tintColor: isDarkMode ? '#fff' : '#000' }]}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.actionLabel, { color: currentTheme.text }]}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity 
  style={styles.actionButton}
  onPress={() => togglePin(longPressedNote.id)}
>
  <View style={[styles.actionIcon, { backgroundColor: currentTheme.actionIconBg }]}>
    <Image
      source={longPressedNote.isPinned 
        ? require('../assets/unpin.png') 
        : require('../assets/pin.png')
      }
      style={[styles.actionIconImage, { tintColor: isDarkMode ? '#fff' : '#000' }]}
      resizeMode="contain"
    />
  </View>
  <Text style={[styles.actionLabel, { color: currentTheme.text }]}>
    {longPressedNote.isPinned ? 'Unpin' : 'Pin'}
  </Text>
</TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => duplicateNote(longPressedNote)}
        >
          <View style={[styles.actionIcon, { backgroundColor: currentTheme.actionIconBg }]}>
            <Image
              source={require('../assets/duplicate.png')}
              style={[styles.actionIconImage, { tintColor: isDarkMode ? '#fff' : '#000' }]}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.actionLabel, { color: currentTheme.text }]}>Duplicate</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => {
            setNoteToDelete(longPressedNote);
            setLongPressedNote(null);  // ← Close long press modal
          }}
        >
          <View style={[styles.actionIcon, styles.deleteIcon, { backgroundColor: currentTheme.actionIconBg }]}>
            <Image
              source={require('../assets/delete.png')}
              style={{ width: 20, height: 20 }}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.actionLabel, { color: currentTheme.text }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
)}

{/* ✅ MOVE THESE TWO MODALS HERE - OUTSIDE AND AFTER LONG PRESS MODAL */}

{/* Delete Confirmation Modal (for single note) */}
{noteToDelete && (
  <View style={styles.modalOverlay}>
    <TouchableOpacity 
      style={styles.modalBackground}
      activeOpacity={1}
      onPress={() => setNoteToDelete(null)}
    />
    
    <View style={[styles.deleteDialog, { backgroundColor: currentTheme.modalBg }]}>
    <Text style={[styles.deleteDialogTitle, { color: currentTheme.text }]}>Delete Note?</Text>
    <Text style={[styles.deleteDialogMessage, { color: currentTheme.textSecondary }]}>
      This action can't be undone.
    </Text>

      <View style={styles.deleteDialogButtons}>
        <TouchableOpacity 
          style={[styles.dialogButton, styles.cancelButton]}
          onPress={() => setNoteToDelete(null)}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.dialogButton, styles.confirmDeleteButton]}
          onPress={() => deleteNote(noteToDelete.id)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
)}

{/* Delete Selected Notes Confirmation Modal */}
{showDeleteConfirmation && (
  <View style={styles.modalOverlay}>
    <TouchableOpacity 
      style={styles.modalBackground}
      activeOpacity={1}
      onPress={() => setShowDeleteConfirmation(false)}
    />
    
    <View style={[styles.deleteDialog, { backgroundColor: currentTheme.modalBg }]}>
    <Text style={[styles.deleteDialogTitle, { color: currentTheme.text }]}>
      Delete {selectedNotes.length} Note{selectedNotes.length > 1 ? 's' : ''}?
    </Text>
    <Text style={[styles.deleteDialogMessage, { color: currentTheme.textSecondary }]}>
      This action can't be undone.
    </Text>

      <View style={styles.deleteDialogButtons}>
        <TouchableOpacity 
          style={[styles.dialogButton, styles.cancelButton]}
          onPress={() => setShowDeleteConfirmation(false)}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.dialogButton, styles.confirmDeleteButton]}
          onPress={deleteSelectedNotes}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
)}

{/* Rate App Modal */}
{showRateModal && (
  <View style={styles.modalOverlay}>
    <TouchableOpacity 
      style={styles.modalBackground}
      activeOpacity={1}
      onPress={() => setShowRateModal(false)}
    />
    
    <View style={[styles.rateModalContainer, { 
      backgroundColor: currentTheme.modalBg,
      borderColor: isDarkMode ? '#9612E4' : '#000000',
 }]}>
      {/* 5 Stars */}
      <View style={styles.starsContainer}>
        <Text style={styles.starIcon}>⭐</Text>
        <Text style={styles.starIcon}>⭐</Text>
        <Text style={styles.starIcon}>⭐</Text>
        <Text style={styles.starIcon}>⭐</Text>
        <Text style={styles.starIcon}>⭐</Text>
      </View>

      {/* Title */}
      <Text style={[styles.rateTitle, { color: currentTheme.text }]}>Love This App?</Text>

      {/* Message */}
      <Text style={[styles.rateMessage, { color: currentTheme.textSecondary }]}>
        Rate me <Text style={styles.rateBold}>5 stars</Text> to help make{'\n'}
        the flashlight even more{'\n'}
        awesome. Thanks!
      </Text>

      {/* Buttons */}
      <View style={styles.rateButtons}>
        <TouchableOpacity 
          style={styles.noThanksButton}
          onPress={() => setShowRateModal(false)}
        >
          <Text style={styles.noThanksText}>No Thanks</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.fiveStarsButton}
          onPress={openAppStore}
        >
          <Text style={styles.fiveStarsText}>5 Stars</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
)}

{/* Banner Ad at Bottom */}
     <View style={styles.adContainer}>
        <AdBanner />
      </View>
      
    </ImageBackground>
  </View>
);
}

const styles = StyleSheet.create({
    container: {
     flex: 1,
},
  headerRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 10,
  paddingBottom: 20,
  marginBottom: 20
},
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    width: 90,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'white',
    borderRadius: 100,
    paddingHorizontal: 12,
    height: 35,
    marginHorizontal: 1,
  },
  searchIcon: {  
    width: 20,
    height: 20,
    marginRight: 10,
    tintColor: '#aaa', // optional (remove if image is colored)
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#C1C1C1',
    alignItems: 'center',
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    fontSize: 24,
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    
  },
  gridCard: {
    width: CARD_WIDTH,
    marginHorizontal: 3,
    marginRight: 8,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    minHeight: 150,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, // Reduced from 20
    shadowRadius: 4, // Reduced from 20
    elevation: 3, // Reduced from 5
  },
  listCard: {
    width: width - 32,
    marginHorizontal: 2,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, // Reduced from 0.3
    shadowRadius: 4, // Reduced from 8
    elevation: 3, // Reduced from 5
  },
  pinIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  pinText: {
    fontSize: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 6,
  },
  cardContent: {
    fontSize: 13,
    color: '#C1C1C1',
    lineHeight: 18,
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 10,
    color: '#C1C1C1',
    marginTop: 'auto',
  },
  fab: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0024CA',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
  },
  menuDropdown: {
    position: 'absolute',
    top: 110,
    right: 20,
    backgroundColor: '#373737ff',
    borderRadius: 20,
    padding: 8,
    minWidth: 129,
    shadowColor: '#00000060'
    
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    color: '#fff',
    fontSize: 14,
  },
  menuOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'transparent',
},
selectModeHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 12,
  backgroundColor: '#2a2a2a',
  marginHorizontal: 16,
  marginBottom: 16,
  borderRadius: 12,
},
cancelText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '600',
},
selectedCountText: {
  color: '#0024CA',
  fontSize: 16,
  fontWeight: '600',
},
selectedCard: {
  borderWidth: 2,
  borderColor: '#ffffffff',
},
cardFooter: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 'auto',
},
checkbox: {
  width: 24,
  height: 24,
  borderRadius: 12,
  borderWidth: 2,
  borderColor: '#ffffff',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'transparent',
},
checkboxSelected: {
  backgroundColor: 'transparent',
  borderColor: '#ffffff',
},
checkboxInner: {
  width: 12,
  height: 12,
  borderRadius: 6,
  backgroundColor: '#ffffff',
},
deleteAllButton: {
  position: 'absolute',
  bottom: 30,
  alignSelf: 'center',
  paddingHorizontal: 32,
  paddingVertical: 16,
  borderRadius: 28,
  backgroundColor: '#ffffff2b',
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.4,
  shadowRadius: 8,
  elevation: 8,
  minWidth: 150,
},
deleteAllText: {
  fontSize: 16,
  color: '#fff',
  fontWeight: '600',
},
// Modal Overlay
modalOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
},
modalBackground: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
},

// Enlarged Card
enlargedCard: {
  width: width - 60,
  maxHeight: '70%',
  borderRadius: 50,
  overflow: 'hidden',
  zIndex: 1001,
  
},
enlargedCardContent: {
  padding: 24,
  minHeight: 350,
  borderWidth: 1,
  borderColor: 'white',
  borderRadius: 50,
},
pinIconLarge: {
  position: 'absolute',
  top: 16,
  right: 16,
},
pinTextLarge: {
  fontSize: 20,
},
pinIconImage: {
  width: 16,
  height: 16,
  tintColor: '#fff', // Makes the icon white (remove if you want original color)
},
pinIconImageLarge: {
  width: 20,
  height: 20,
  tintColor: '#fff', // Makes the icon white (remove if you want original color)
},
enlargedTitle: {
  fontSize: 24,
  fontWeight: 'bold',
  color: '#ffffff',
  marginBottom: 16,
  marginTop: 8,
},
enlargedContent: {
  fontSize: 16,
  color: '#E0E0E0',
  lineHeight: 24,
},

// Action Buttons
actionButtons: {
  flexDirection: 'row',
  backgroundColor: '#2a2a2a',
  borderWidth: 1,
  borderColor: 'white',
  paddingVertical: 8,
  paddingHorizontal: 8,
  justifyContent: 'center',
  borderRadius: 100,
  marginTop: 10,
},
actionButton: {
  alignItems: 'center',
  justifyContent: 'center',
  padding: 8,
  minWidth: 60,
},
actionIcon: {
  width: 48,
  height: 48,
  borderRadius: 24,
  backgroundColor: 'transparent',
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 1,
},
deleteIcon: {
  backgroundColor: 'transparent',
},
actionIconText: {
  fontSize: 20,
},
actionLabel: {
  fontSize: 12,
  color: '#ffffff',
  marginTop: 4,
},

// Delete Dialog
deleteDialog: {
  backgroundColor: '#2a2a2a',
  borderRadius: 50,
  borderWidth: 1,
  borderColor: 'white',
  padding: 24,
  width: width - 80,
  zIndex: 1001,
},
deleteDialogTitle: {
  fontSize: 20,
  fontWeight: 'bold',
  color: '#ffffff',
  marginBottom: 12,
  textAlign: 'left',
},
deleteDialogMessage: {
  fontSize: 14,
  color: '#C1C1C1',
  marginBottom: 24,
  textAlign: 'left',
},
deleteDialogButtons: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  gap: 12,
},
dialogButton: {
  flex: 1,
  paddingVertical: 12,
  borderRadius: 12,
  alignItems: 'center',
},
cancelButton: {
  backgroundColor: '#ffffff2b',
  borderRadius: 50,
},
cancelButtonText: {
  color: '#ffffff',
  fontSize: 16,
  fontWeight: '600',
},
confirmDeleteButton: {
  backgroundColor: '#ffffff2b',
  borderRadius: 50,
},
deleteButtonText: {
  color: '#D90303',
  fontSize: 16,
  fontWeight: '600',
},
// Rate App Modal Styles
rateModalContainer: {
  backgroundColor: '#2a2a2a',
  borderRadius: 50,
  padding: 32,
  width: width - 60,
  alignItems: 'center',
  zIndex: 1001,
  borderWidth: 1,
  borderColor: 'white', // Purple border
},
starsContainer: {
  flexDirection: 'row',
  marginBottom: 24,
  gap: 8,
},
starIcon: {
  fontSize: 40,
},
rateTitle: {
  fontSize: 28,
  fontWeight: 'bold',
  color: '#ffffff',
  marginBottom: 16,
  marginRight: 60,
  textAlign: 'left',
},
rateMessage: {
  fontSize: 16,
  color: '#C1C1C1',
  textAlign: 'left',
  lineHeight: 24,
  marginBottom: 28,
  marginRight: 40,
},
rateBold: {
  fontWeight: 'bold',
  color: '#ffffff',
},
rateButtons: {
  flexDirection: 'row',
  gap: 16,
  width: '100%',
},
noThanksButton: {
  flex: 1,
  paddingVertical: 14,
  borderRadius: 25,
  backgroundColor: 'transparent',
  alignItems: 'center',
  borderWidth: 0,
},
noThanksText: {
  color: '#ffffff',
  fontSize: 16,
  fontWeight: '600',
},
fiveStarsButton: {
  flex: 1,
  paddingVertical: 14,
  borderRadius: 25,
  backgroundColor: '#ffffff',
  alignItems: 'center',
},
fiveStarsText: {
  color: '#000000',
  fontSize: 16,
  fontWeight: '600',
},
adContainer: {  // ← ADD THIS
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  paddingBottom: 20,
},
actionIconImage: {
  width: 24,
  height: 24,
},
});