const { clipboard, globalShortcut } = require('electron');
const { promisify } = require('util');
const { exec, spawn } = require('child_process');
const execAsync = promisify(exec);

class ClipboardMonitor {
    constructor() {
        this.lastClipboardContent = '';
        this.isMonitoring = false;
        this.pythonProcess = null;
        this.isProcessingPaste = false;
    }

    async getCurrentAppContext() {
        try {
            // Get the frontmost application name
            const { stdout } = await execAsync(`
                osascript -e '
                tell application "System Events"
                    set frontApp to name of first application process whose frontmost is true
                    return frontApp
                end tell'
            `);
            
            const appName = stdout.trim();
            
            // Get more specific context based on the app
            let context = appName;
            
            // Try to get more specific context for certain apps
            if (appName.toLowerCase().includes('chrome') || appName.toLowerCase().includes('safari') || appName.toLowerCase().includes('firefox')) {
                try {
                    // Try to get the current URL/page title for browsers
                    const { stdout: urlInfo } = await execAsync(`
                        osascript -e '
                        tell application "${appName}"
                            try
                                if (count of windows) > 0 then
                                    set currentTab to active tab of front window
                                    set pageTitle to title of currentTab
                                    set pageURL to URL of currentTab
                                    return pageTitle & " - " & pageURL
                                else
                                    return "${appName} browser"
                                end if
                            on error
                                return "${appName} browser"
                            end try
                        end tell'
                    `);
                    context = urlInfo.trim();
                } catch (error) {
                    context = `${appName} browser`;
                }
            } else if (appName.toLowerCase().includes('code') || appName.toLowerCase().includes('sublime') || appName.toLowerCase().includes('atom')) {
                context = `${appName} code editor`;
            } else if (appName.toLowerCase().includes('terminal') || appName.toLowerCase().includes('iterm')) {
                context = `${appName} terminal`;
            } else if (appName.toLowerCase().includes('slack') || appName.toLowerCase().includes('discord') || appName.toLowerCase().includes('teams')) {
                context = `${appName} messaging app`;
            } else if (appName.toLowerCase().includes('mail') || appName.toLowerCase().includes('outlook')) {
                context = `${appName} email client`;
            } else if (appName.toLowerCase().includes('word') || appName.toLowerCase().includes('pages') || appName.toLowerCase().includes('docs')) {
                context = `${appName} document editor`;
            }
            
            return context;
            
        } catch (error) {
            console.error('Error getting current app context:', error);
            return 'unknown application';
        }
    }

    registerShortcut() {
        globalShortcut.unregisterAll();
        
        const success = globalShortcut.register('CommandOrControl+`', async () => {
            console.log('global hotkey pressed: smart paste');
            
            // Prevent multiple simultaneous requests
            if (this.isProcessingPaste) {
                console.log('Already processing paste, ignoring');
                return;
            }
            
            // Get current app context dynamically
            const currentContext = await this.getCurrentAppContext();
            console.log('Current app context:', currentContext);
            
            this.sendToBackend('paste', currentContext);
        });

        if (!success) {
            console.warn('Failed to register global shortcut');
        } else {
            console.log('global shortcut registered');
        }
    }

    startMonitoring() {
        if (this.isMonitoring) return;

        this.registerShortcut();

        // Clear the clipboard when monitoring starts
        clipboard.clear();
        this.lastClipboardContent = '';

        this.startPythonBackend();

        this.isMonitoring = true;
        console.log('Clipboard monitoring started');
        
        this.intervalId = setInterval(() => {
            // Skip if monitoring is disabled or processing paste
            if (!this.isMonitoring || this.isProcessingPaste) return;
            
            const currentContent = clipboard.readText();
            if (currentContent !== this.lastClipboardContent && currentContent.length > 0) {
                this.onClipboardChange(currentContent);
                this.lastClipboardContent = currentContent;
            }
        }, 300); // Reduced from 500ms to 300ms for faster detection
    }

    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.isMonitoring = false;
            console.log('monitoring stopped');
        }

        if (this.pythonProcess) {
            this.pythonProcess.kill();
            this.pythonProcess = null;
        }
    }

    startPythonBackend() {
        const pythonPath = '../backend/venv/bin/python3';

        this.pythonProcess = spawn(pythonPath, ['../backend/main.py'], {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe']
        });

        //listen to stdout from python
        this.pythonProcess.stdout.on('data', async (data) => {
            const aiResponse = data.toString().trim();
            
            // Set processing flag to prevent interference
            this.isProcessingPaste = true;
            
            try {
                // Paste the text immediately
                await this.pasteText(aiResponse);
                
                // Much shorter wait time
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Update lastClipboardContent to current clipboard state
                this.lastClipboardContent = clipboard.readText();
                
            } catch (error) {
                console.error('Error in paste operation:', error);
            } finally {
                // Always clear the processing flag
                this.isProcessingPaste = false;
            }
        });

        //listen to stderr from python
        this.pythonProcess.stderr.on('data', (data) => {
            console.log('Python error:', data.toString());
        });

        this.pythonProcess.on('close', (code) => {
            console.log(`Python process exited with code ${code}`);
            this.pythonProcess = null;
        });
    }

    onClipboardChange(content) {
        this.sendToBackend('copy', content);
    }

    async pasteText(text) {
        try {
            // For safety, limit text length
            if (text.length > 2000) {
                text = text.substring(0, 2000) + '...';
            }

            // Store original clipboard content
            const originalClipboard = clipboard.readText();
            if (text === 'None') {
                // If the text is 'None', write an empty string to the clipboard
                clipboard.writeText('');
            } else {
                // Temporarily write AI response to clipboard
                clipboard.writeText(text);
            }

            // Minimal delay - just enough for clipboard to update
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Paste using Cmd+V
            await execAsync(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);
            
            // Restore original clipboard quickly
            setTimeout(() => {
                clipboard.writeText(originalClipboard);
            }, 100);
            
        } catch (error) {
            console.error('Error pasting text:', error);
        }
    }

    async sendToBackend(type, content) {
        try {
            if (!this.pythonProcess) {
                console.log('Python backend is not running, starting it now...');
                this.startPythonBackend();
                // Reduced wait time
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            const message = JSON.stringify({
                type: type,
                content: content,
                source: 'macOS'
            }) + '\n';
            
            this.pythonProcess.stdin.write(message);
            
        } catch (error) {
            console.error('Error sending to backend:', error);
        }
    }
}

module.exports = ClipboardMonitor;