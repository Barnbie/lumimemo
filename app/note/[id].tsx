import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Linking,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AdBanner from '../../components/AdBanner';

const { width } = Dimensions.get('window');

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
  timestamp: number;
  attachments?: Attachment[];
}

interface Attachment {
  id: string;
  type: 'image' | 'pdf';
  uri: string;
  name: string;
}

const EDITOR_THEME = {
  dark: {
    background: require('../../assets/dark-background.png'),
    text: '#ffffff',
    textSecondary: '#C1C1C1',
    iconColor: '#fff',
    undoRedoBg: 'rgba(42, 42, 42, 0.95)',
  },
  light: {
    background: require('../../assets/light-background.png'),
    text: '#000000',
    textSecondary: '#666666',
    iconColor: '#000',
    undoRedoBg: 'rgba(217, 217, 217, 0.95)',
  },
};

// HTML Template for the custom editor
const getEditorHTML = (isDark: boolean, initialContent: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      line-height: 24px;
      color: ${isDark ? '#C1C1C1' : '#666666'};
      background: transparent;
      padding: 0;
      margin: 0;
    }
    
    #editor {
      min-height: 400px;
      outline: none;
      padding: 0;
      word-wrap: break-word;
      overflow-wrap: break-word;
      position: relative;
    }
    
    #editor:empty:before {
      content: attr(placeholder);
      color: ${isDark ? '#666' : '#999'};
      pointer-events: none;
      display: block;
    }
    
    /* Checkbox styling */
    .checkbox-line {
      display: block;
      margin: 8px 0;
      padding: 0;
      text-indent: 0;
      position: relative;
    }
    
    .checkbox-line input[type="checkbox"] {
      width: 18px;
      height: 18px;
      margin-right: 8px;
      vertical-align: top;
      display: inline-block;
    }
    
    .checkbox-line .checkbox-text {
      display: inline;
      vertical-align: top;
      outline: none;
    }
    
    /* Link styling */
    a {
      color: #2970dcff;
      text-decoration: underline;
      cursor: pointer;
      background-color: transparent !important;
    }
    
    /* List styling - NO INDENTATION */
    ul, ol {
      padding-left: 24px;
      margin: 8px 0;
      display: block;
    }

    li {
      margin: 4px 0;
      padding: 2px 0;
      display: list-item;
    }

    ul {
      list-style-type: disc;
    }

    ol {
      list-style-type: decimal;
    }
  </style>
</head>
<body>
  <div id="editor" contenteditable="true" placeholder="Start typing..."></div>
  
  <script>
    const editor = document.getElementById('editor');
    let isUpdating = false;
    
    // Initialize content
    try {
      const initial = \`${initialContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
      editor.innerHTML = initial || '';
    } catch (e) {
      editor.innerHTML = '';
    }
    
    // Send content immediately
    function sendContent() {
  if (isUpdating) return;
  
  try {
    // CRITICAL FIX: Clone editor content and add 'checked' attributes
    const clone = editor.cloneNode(true);
    
    // Find all checkboxes and add 'checked' attribute if they're checked
    const checkboxes = clone.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox) => {
      // Get the original checkbox from the actual editor
      const originalCheckbox = Array.from(editor.querySelectorAll('input[type="checkbox"]'))
        .find((cb, idx) => idx === Array.from(checkboxes).indexOf(checkbox));
      
      if (originalCheckbox && originalCheckbox.checked) {
        checkbox.setAttribute('checked', '');
      } else {
        checkbox.removeAttribute('checked');
      }
    });
    
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'contentChange',
      content: clone.innerHTML
    }));
  } catch (e) {
    console.error('sendContent error:', e);
  }
}
    
    // Handle placeholder
    function updatePlaceholder() {
      const text = editor.innerText.trim();
      if (!text || text === '') {
        editor.innerHTML = '';
      }
    }
    
    editor.addEventListener('input', () => {
      updatePlaceholder();
      sendContent();
    });
    
    // Handle checkbox changes - use 'click' instead of 'change' for immediate response
editor.addEventListener('click', (e) => {
  if (e.target && e.target.type === 'checkbox') {
    // Small delay to ensure checkbox state is updated in DOM
    setTimeout(() => {
      sendContent();
    }, 50);
  }
}, true);

// Also keep change event as backup
editor.addEventListener('change', (e) => {
  if (e.target && e.target.type === 'checkbox') {
    setTimeout(() => {
      sendContent();
    }, 50);
  }
}, true);
    
    // Handle link clicks
    editor.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        e.preventDefault();
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'linkClick',
            url: e.target.href
          }));
        } catch (err) {}
      }
    });
    
    // Insert link
    function insertLink(text, url) {
      const link = document.createElement('a');
      link.href = url;
      link.textContent = text;
      
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(link);
        range.insertNode(document.createTextNode(' '));
        range.collapse(false);
      } else {
        editor.appendChild(link);
        editor.appendChild(document.createTextNode(' '));
      }
      
      sendContent();
    }
    
    // Insert checkbox
  function insertCheckbox() {
  const selection = window.getSelection();
  
  // Exit any existing list first
  if (selection.rangeCount > 0) {
    let node = selection.anchorNode;
    let tempNode = node;
    
    // Check if we're inside a list (ul/ol)
    while (tempNode && tempNode !== editor) {
      if (tempNode.tagName === 'UL' || tempNode.tagName === 'OL') {
        // We're in a list - move cursor outside
        const range = selection.getRangeAt(0);
        range.setStartAfter(tempNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        break;
      }
      tempNode = tempNode.parentElement;
    }
  }
  
  const checkbox = document.createElement('div');
  checkbox.className = 'checkbox-line';
  
  const input = document.createElement('input');
  input.type = 'checkbox';
  
  const textSpan = document.createElement('span');
  textSpan.className = 'checkbox-text';
  textSpan.contentEditable = 'true';
  textSpan.innerHTML = '&#8203;';
  
  checkbox.appendChild(input);
  checkbox.appendChild(textSpan);
  
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(checkbox);
    
    const newRange = document.createRange();
    newRange.selectNodeContents(textSpan);
    newRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(newRange);
  } else {
    editor.appendChild(checkbox);
    textSpan.focus();
  }
  
  editor.focus();
  sendContent();
}
    
    function insertBulletList() {
  const selection = window.getSelection();
  
  // Exit any existing list/checkbox first
  if (selection.rangeCount > 0) {
    let node = selection.anchorNode;
    let tempNode = node;
    
    // Check if we're inside a checkbox or another list
    while (tempNode && tempNode !== editor) {
      if (tempNode.tagName === 'UL' || tempNode.tagName === 'OL' || 
          (tempNode.classList && tempNode.classList.contains('checkbox-line'))) {
        // Move cursor outside
        const range = selection.getRangeAt(0);
        range.setStartAfter(tempNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        break;
      }
      tempNode = tempNode.parentElement;
    }
  }
  
  const ul = document.createElement('ul');
  const li = document.createElement('li');
  li.innerHTML = '&#8203;';
  ul.appendChild(li);
  
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(ul);
    
    const newRange = document.createRange();
    newRange.selectNodeContents(li);
    newRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(newRange);
  } else {
    editor.appendChild(ul);
  }
  
  editor.focus();
  sendContent();
}
    
    // Insert numbered list
    function insertNumberedList() {
  const selection = window.getSelection();
  
  // Exit any existing list/checkbox first
  if (selection.rangeCount > 0) {
    let node = selection.anchorNode;
    let tempNode = node;
    
    // Check if we're inside a checkbox or another list
    while (tempNode && tempNode !== editor) {
      if (tempNode.tagName === 'UL' || tempNode.tagName === 'OL' || 
          (tempNode.classList && tempNode.classList.contains('checkbox-line'))) {
        // Move cursor outside
        const range = selection.getRangeAt(0);
        range.setStartAfter(tempNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        break;
      }
      tempNode = tempNode.parentElement;
    }
  }
  
  const ol = document.createElement('ol');
  const li = document.createElement('li');
  li.innerHTML = '&#8203;';
  ol.appendChild(li);
  
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(ol);
    
    const newRange = document.createRange();
    newRange.selectNodeContents(li);
    newRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(newRange);
  } else {
    editor.appendChild(ol);
  }
  
  editor.focus();
  sendContent();
}
    
    // Set content
    function setContent(html) {
      isUpdating = true;
      editor.innerHTML = html || '';
      isUpdating = false;
    }
    
    // Handle Enter key
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        let node = selection.anchorNode;
        
        // Handle checkbox
        let checkboxLine = null;
        let tempNode = node;
        while (tempNode && tempNode !== editor) {
          if (tempNode.classList && tempNode.classList.contains('checkbox-line')) {
            checkboxLine = tempNode;
            break;
          }
          tempNode = tempNode.parentElement;
        }
        
        if (checkboxLine) {
          e.preventDefault();
          
          // Check if checkbox text is empty
          const textSpan = checkboxLine.querySelector('.checkbox-text');
          const isEmpty = !textSpan || textSpan.textContent.trim() === '' || textSpan.textContent === '​';
          
          if (isEmpty) {
            // Empty checkbox - exit and go to normal text
            const br = document.createElement('br');
            const textNode = document.createTextNode('​');
            
            if (checkboxLine.nextSibling) {
              checkboxLine.parentNode.insertBefore(br, checkboxLine.nextSibling);
              checkboxLine.parentNode.insertBefore(textNode, br.nextSibling);
            } else {
              checkboxLine.parentNode.appendChild(br);
              checkboxLine.parentNode.appendChild(textNode);
            }
            
            checkboxLine.remove();
            
            const newRange = document.createRange();
            newRange.setStart(textNode, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          } else {
            // FIXED: Has content - create new checkbox as SIBLING
    const newCheckboxLine = document.createElement('div');
    newCheckboxLine.className = 'checkbox-line';
    
    const newInput = document.createElement('input');
    newInput.type = 'checkbox';
    
    const newTextSpan = document.createElement('span');
    newTextSpan.className = 'checkbox-text';
    newTextSpan.contentEditable = 'true';
    newTextSpan.innerHTML = '&#8203;';
    
    newCheckboxLine.appendChild(newInput);
    newCheckboxLine.appendChild(newTextSpan);
    
    // Insert as sibling AFTER the current checkbox
    if (checkboxLine.nextSibling) {
      checkboxLine.parentNode.insertBefore(newCheckboxLine, checkboxLine.nextSibling);
    } else {
      checkboxLine.parentNode.appendChild(newCheckboxLine);
    }
    
    // Move cursor to new checkbox
    const newRange = document.createRange();
    newRange.selectNodeContents(newTextSpan);
    newRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }
  
  sendContent();
  return;
}
        
        // Handle ul/ol lists
        tempNode = node;
        while (tempNode && tempNode !== editor) {
          if (tempNode.tagName === 'LI') {
            const parentList = tempNode.parentElement;
            if (parentList && (parentList.tagName === 'UL' || parentList.tagName === 'OL')) {
              e.preventDefault();
              
              // Check if li is empty
              const isEmpty = tempNode.textContent.trim() === '' || tempNode.textContent === '​';
              
              if (isEmpty) {
                // Empty list item - exit list
                const br = document.createElement('br');
                const textNode = document.createTextNode('​');
                
                if (parentList.nextSibling) {
                  parentList.parentNode.insertBefore(br, parentList.nextSibling);
                  parentList.parentNode.insertBefore(textNode, br.nextSibling);
                } else {
                  parentList.parentNode.appendChild(br);
                  parentList.parentNode.appendChild(textNode);
                }
                
                tempNode.remove();
                
                // If list is now empty, remove it
                if (parentList.children.length === 0) {
                  parentList.remove();
                }
                
                const newRange = document.createRange();
                newRange.setStart(textNode, 0);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
              } else {
                // Has content - create new list item
                const newLi = document.createElement('li');
                newLi.innerHTML = '&#8203;';
                
                if (tempNode.nextSibling) {
                  parentList.insertBefore(newLi, tempNode.nextSibling);
                } else {
                  parentList.appendChild(newLi);
                }
                
                const newRange = document.createRange();
                newRange.selectNodeContents(newLi);
                newRange.collapse(false);
                selection.removeAllRanges();
                selection.addRange(newRange);
              }
              
              sendContent();
              return;
            }
          }
          tempNode = tempNode.parentElement;
        }
      }
    });
    
    // Message handling
    function handleMessage(messageData) {
      try {
        const data = typeof messageData === 'string' ? JSON.parse(messageData) : messageData;
        
        switch(data.type) {
          case 'insertCheckbox':
            insertCheckbox();
            break;
          case 'insertLink':
            insertLink(data.text, data.url);
            break;
          case 'insertBulletList':
            insertBulletList();
            break;
          case 'insertNumberedList':
            insertNumberedList();
            break;
          case 'setContent':
            setContent(data.content);
            break;
          case 'getContent':
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'contentResponse',
              content: editor.innerHTML
            }));
            break;
        }
      } catch (error) {}
    }
    
    document.addEventListener('message', (e) => handleMessage(e.data));
    window.addEventListener('message', (e) => handleMessage(e.data));
  </script>
</body>
</html>
`;

export default function NoteEditor() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const noteId = params.id as string;
  const isNewNote = noteId === 'new';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noteColor, setNoteColor] = useState('#373737ff');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [history, setHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const historyRef = useRef(history);  // ← ADD THIS
  const historyIndexRef = useRef(historyIndex);
  const webViewRef = useRef<WebView>(null);
  const contentRef = useRef(content);
  const updateTimerRef = useRef<any>(null);
  const currentTheme = isDarkMode ? EDITOR_THEME.dark : EDITOR_THEME.light;

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

  const loadNote = async () => {
    try {
      const savedNotes = await AsyncStorage.getItem('notes');
      if (savedNotes) {
        const notes: Note[] = JSON.parse(savedNotes);
        const note = notes.find((n) => n.id === noteId);
        if (note) {
          setTitle(note.title);
          setContent(note.content);
          setNoteColor(note.color);
          setAttachments(note.attachments || []);
          setHistory([note.content]);
          setHistoryIndex(0);
          // Force WebView reload with new content
          setWebViewKey(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Error loading note:', error);
    }
  };

  useEffect(() => {
    loadTheme();
    if (!isNewNote) {
      loadNote();
    }
  }, []);

  const saveNote = async () => {
  try {
    // CRITICAL FIX: Clear the timer and immediately save whatever is in contentRef
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
      updateTimerRef.current = null;
    }
    
    // Use contentRef.current as the source of truth - it has the latest typed content
    const finalContent = contentRef.current;

    // ADD THESE DEBUG LOGS
    console.log('=== SAVING NOTE ===');
    console.log('Content length:', finalContent.length);
    console.log('First 500 chars:', finalContent.substring(0, 500));
    console.log('Contains checked:', finalContent.includes('checked'));
    
    setContent(finalContent);
    
    // Also update the state to match before saving
    setContent(finalContent);
    
    const savedNotes = await AsyncStorage.getItem('notes');
    const notes: Note[] = savedNotes ? JSON.parse(savedNotes) : [];

    if (isNewNote) {
      const newNote: Note = {
          id: Date.now().toString(),
          title: title || 'Untitled',
          content: finalContent,
          color: noteColor,
          isPinned: false,
          timestamp: Date.now(),
          attachments: attachments,
        };
        notes.unshift(newNote);
      } else {
        const noteIndex = notes.findIndex((n) => n.id === noteId);
        if (noteIndex !== -1) {
          notes[noteIndex] = {
            ...notes[noteIndex],
            title: title || 'Untitled',
            content: finalContent,
            timestamp: Date.now(),
            attachments: attachments,
          };
        }
      }

      await AsyncStorage.setItem('notes', JSON.stringify(notes));
      router.back();
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  useEffect(() => {
  return () => {
    // Cleanup: if component unmounts, clear the timer
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }
  };
}, []);

useEffect(() => {
  historyRef.current = history;
}, [history]);

useEffect(() => {
  historyIndexRef.current = historyIndex;
}, [historyIndex]);



const handleWebViewMessage = (event: any) => {
  try {
    const data = JSON.parse(event.nativeEvent.data);
    
    switch(data.type) {
  case 'contentChange':
    const oldContent = contentRef.current;
    const newContent = data.content;
    contentRef.current = newContent;
    
    // CRITICAL: Also update state immediately for checkbox changes
    const oldCheckboxes = (oldContent.match(/type="checkbox"[^>]*checked/g) || []).length;
    const newCheckboxes = (newContent.match(/type="checkbox"[^>]*checked/g) || []).length;
    
    if (oldCheckboxes !== newCheckboxes) {
      console.log('🔄 Checkbox state changed, updating...');
      setContent(newContent); // ← ADD THIS LINE
      autoSaveCheckboxes();
    }
    
    // Rest of your code...
    
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }
    
    updateTimerRef.current = setTimeout(() => {
      const currentHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      
      if (currentHistory[currentHistory.length - 1] !== data.content) {
        const newHistory = [...currentHistory, data.content];
        const newIndex = newHistory.length - 1;
        
        setHistory(newHistory);
        setHistoryIndex(newIndex);
        setCanUndo(newIndex > 0);
        setCanRedo(false);
      }
    }, 500);
    break;
    
  case 'linkClick':
    Linking.openURL(data.url).catch(err => 
      Alert.alert('Error', 'Cannot open this link')
    );
    break;
}
  } catch (error) {
    console.error('Error handling WebView message:', error);
  }
};

const autoSaveCheckboxes = async () => {
  try {
    if (isNewNote) return;
    
    const savedNotes = await AsyncStorage.getItem('notes');
    const notes: Note[] = savedNotes ? JSON.parse(savedNotes) : [];
    
    const noteIndex = notes.findIndex((n) => n.id === noteId);
    if (noteIndex !== -1) {
      const contentToSave = contentRef.current;
      
      console.log('💾 Saving checkbox state:', contentToSave.substring(0, 200)); // Debug
      
      notes[noteIndex] = {
        ...notes[noteIndex],
        content: contentToSave,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem('notes', JSON.stringify(notes));
      console.log('✅ Checkbox auto-saved!');
    }
  } catch (error) {
    console.error('Error auto-saving checkboxes:', error);
  }
};

  const sendMessageToWebView = (message: any) => {
    try {
      webViewRef.current?.postMessage(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending message to WebView:', error);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newAttachment: Attachment = {
        id: Date.now().toString(),
        type: 'image',
        uri: result.assets[0].uri,
        name: `Image_${Date.now()}.jpg`,
      };
      setAttachments([...attachments, newAttachment]);
    }
  };

  const pickPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets?.[0];
      if (!file) return;

      const newAttachment: Attachment = {
        id: Date.now().toString(),
        type: 'pdf',
        uri: file.uri,
        name: file.name ?? 'Document.pdf',
      };

      setAttachments((prev) => [...prev, newAttachment]);
    } catch (error) {
      console.error('Error picking PDF:', error);
    }
  };

  const insertCheckbox = () => {
    sendMessageToWebView({ type: 'insertCheckbox' });
  };

  const insertBulletList = () => {
    sendMessageToWebView({ type: 'insertBulletList' });
  };

  const insertNumberedList = () => {
    sendMessageToWebView({ type: 'insertNumberedList' });
  };

  const insertLink = () => {
    setShowLinkModal(true);
  };

  const addLink = () => {
    if (!linkUrl.trim()) {
      Alert.alert('Error', 'Please enter a URL');
      return;
    }

    const displayText = linkText.trim() || linkUrl;
    let fullUrl = linkUrl.trim();

    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      fullUrl = 'https://' + fullUrl;
    }

    sendMessageToWebView({
      type: 'insertLink',
      text: displayText,
      url: fullUrl,
    });

    setLinkUrl('');
    setLinkText('');
    setShowLinkModal(false);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const previousContent = history[newIndex];
      setContent(previousContent);
      sendMessageToWebView({ type: 'setContent', content: previousContent });
      setCanUndo(newIndex > 0);
      setCanRedo(true);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const nextContent = history[newIndex];
      setContent(nextContent);
      sendMessageToWebView({ type: 'setContent', content: nextContent });
      setCanUndo(true);
      setCanRedo(newIndex < history.length - 1);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter((att) => att.id !== id));
  };

  const shareNote = async () => {
    try {
      const { Share } = require('react-native');
      const message = `${title || 'Untitled'}\n\n${content}`;
      await Share.share({
        message: message,
        title: title || 'My Note',
      });
    } catch (error) {
      console.error('Error sharing note:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent={true}
      />
      <ImageBackground
        source={currentTheme.background}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Image
                source={require('../../assets/back.png')}
                style={[styles.backIcon, { tintColor: currentTheme.iconColor }]}
                resizeMode="contain"
              />
            </TouchableOpacity>

            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerButton} onPress={shareNote}>
                <Image
                  source={require('../../assets/share.png')}
                  style={[styles.headerIcon, { tintColor: currentTheme.iconColor }]}
                  resizeMode="contain"
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.doneButton} onPress={saveNote}>
                <Image
                  source={require('../../assets/done.png')}
                  style={styles.doneIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.editorContainer}
            contentContainerStyle={styles.editorContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TextInput
              style={[styles.titleInput, { color: currentTheme.text }]}
              placeholder="Heading"
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                setCanUndo(true);
              }}
              multiline
              autoFocus={isNewNote}
            />

            {attachments.length > 0 && (
              <View style={styles.attachmentsContainer}>
                {attachments.map((att) => (
                  <View key={att.id} style={styles.attachmentItem}>
                    {att.type === 'image' && (
                      <Image source={{ uri: att.uri }} style={styles.attachmentImage} />
                    )}
                    {att.type === 'pdf' && (
                      <View style={styles.pdfAttachment}>
                        <Text style={[styles.pdfText, { color: currentTheme.text }]}>
                          📄 {att.name}
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.removeAttachment}
                      onPress={() => removeAttachment(att.id)}
                    >
                      <Text style={styles.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Custom Rich Text Editor */}
            <View style={styles.webViewContainer}>
              <WebView
                key={webViewKey}
                ref={webViewRef}
                source={{ html: getEditorHTML(isDarkMode, content) }}
                onMessage={handleWebViewMessage}
                onLoad={() => {
                  console.log('WebView loaded');
                }}
                style={styles.webView}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                originWhitelist={['*']}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                automaticallyAdjustContentInsets={false}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                nestedScrollEnabled={true}
                focusable={true}
                keyboardDisplayRequiresUserAction={false}  // ← ADD THIS LINE
                hideKeyboardAccessoryView={false}   
                onContentProcessDidTerminate={() => {
                  setWebViewKey(prev => prev + 1);
                }}
              />
            </View>
          </ScrollView>

          {/* Toolbar */}
          <View style={styles.bottomButtonsContainer}>
            <View style={[styles.toolbar, { backgroundColor: currentTheme.undoRedoBg }]}>
              <TouchableOpacity style={styles.toolButton} onPress={pickImage}>
                <Image
                  source={require('../../assets/image.png')}
                  style={[styles.toolIconImage, { tintColor: currentTheme.iconColor }]}
                  resizeMode="contain"
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.toolButton} onPress={pickPDF}>
                <Image
                  source={require('../../assets/docs.png')}
                  style={[styles.toolIconImage, { tintColor: currentTheme.iconColor }]}
                  resizeMode="contain"
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.toolButton} onPress={insertCheckbox}>
                <Text style={[styles.toolIcon, { color: currentTheme.text }]}>☐</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.toolButton} onPress={insertBulletList}>
                <Image
                  source={require('../../assets/bullet_list.png')}
                  style={[styles.toolIconImage, { tintColor: currentTheme.iconColor }]}
                  resizeMode="contain"
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.toolButton} onPress={insertNumberedList}>
                <Image
                  source={require('../../assets/numbered_list.png')}
                  style={[styles.toolIconImage, { tintColor: currentTheme.iconColor }]}
                  resizeMode="contain"
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.toolButton} onPress={insertLink}>
                <Image
                  source={require('../../assets/link.png')}
                  style={[styles.toolIconImage, { tintColor: currentTheme.iconColor }]}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>

            <View style={[styles.undoRedoContainer, { backgroundColor: currentTheme.undoRedoBg }]}>
              <TouchableOpacity 
                style={[styles.undoRedoButton, !canUndo && styles.disabledButton]} 
                onPress={undo}
                disabled={!canUndo}
              >
                <Image
                  source={require('../../assets/undo.png')}
                  style={[
                    styles.undoRedoIcon,
                    !canUndo && styles.disabledIcon,
                    { tintColor: currentTheme.iconColor }
                  ]}
                  resizeMode="contain"
                />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.undoRedoButton, !canRedo && styles.disabledButton]} 
                onPress={redo}
                disabled={!canRedo}
              >
                <Image
                  source={require('../../assets/redo.png')}
                  style={[
                    styles.undoRedoIcon,
                    !canRedo && styles.disabledIcon,
                    { tintColor: currentTheme.iconColor }
                  ]}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* Link Modal */}
        {showLinkModal && (
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackground}
              activeOpacity={1}
              onPress={() => {
                setShowLinkModal(false);
                setLinkUrl('');
                setLinkText('');
              }}
            />

            <View style={[styles.linkModal, { backgroundColor: currentTheme.undoRedoBg }]}>
              <Text style={[styles.linkModalTitle, { color: currentTheme.text }]}>Add Link</Text>

              <TextInput
                style={[
                  styles.linkInput,
                  {
                    color: currentTheme.text,
                    borderColor: currentTheme.text,
                  },
                ]}
                placeholder="Link text (e.g., Lumi Note)"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={linkText}
                onChangeText={setLinkText}
                autoFocus
              />

              <TextInput
                style={[
                  styles.linkInput,
                  {
                    color: currentTheme.text,
                    borderColor: currentTheme.text,
                  },
                ]}
                placeholder="URL (e.g., https://luminote.com)"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={linkUrl}
                onChangeText={setLinkUrl}
                keyboardType="url"
                autoCapitalize="none"
              />

              <View style={styles.linkModalButtons}>
                <TouchableOpacity
                  style={[styles.linkModalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowLinkModal(false);
                    setLinkUrl('');
                    setLinkText('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.linkModalButton, styles.addButton]} onPress={addLink}>
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
       )}
      {/* Banner Ad at Bottom of Editor */}
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
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    width: 24,
    height: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    width: 40,
    height: 40,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  doneButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0024CA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
  editorContainer: {
    flex: 1,
  },
  editorContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    paddingVertical: 8,
  },
  webViewContainer: {
    minHeight: 400,
    backgroundColor: 'transparent',
    pointerEvents: 'auto',
  },
  webView: {
    backgroundColor: 'transparent',
    minHeight: 400,
  },
  undoRedoContainer: {
    flexDirection: 'row',
    gap: 6,
    borderRadius: 25,
    paddingHorizontal: 6,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  undoRedoButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
  },
  undoRedoIcon: {
    width: 25,
    height: 25,
  },
  disabledButton: {
    opacity: 0.3,
  },
  disabledIcon: {
    opacity: 0.3,
  },
  attachmentsContainer: {
    marginBottom: 16,
  },
  attachmentItem: {
    marginBottom: 12,
    position: 'relative',
  },
  attachmentImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  pdfAttachment: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  pdfText: {
    fontSize: 14,
  },
  removeAttachment: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 70 : 50,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 0,
    borderRadius: 25,
    paddingHorizontal: 6,
    paddingVertical: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  toolButton: {
    width: 34,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  toolIconImage: {
    width: 18,
    height: 18,
  },
  toolIcon: {
    fontSize: 20,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 80,
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  linkModal: {
    width: width - 60,
    padding: 24,
    borderRadius: 50,
    zIndex: 1001,
  },
  linkModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  linkInput: {
    borderWidth: 1,
    borderRadius: 50,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  linkModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  linkModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 50,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#0024CA',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  adContainer: {
  position: 'absolute',
  bottom: Platform.OS === 'ios' ? 70 : 50,  // Match the toolbar padding
  left: 0,
  right: 0,
  paddingBottom: 10,
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
  zIndex: 100,
},
});
    