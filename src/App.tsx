import React, { useState, useCallback, useEffect } from 'react';
import { Copy, RefreshCw, Save, Trash2, LogOut, Eye, EyeOff } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

// Define a type for saved passwords (matching the table structure)
interface SavedPassword {
  id: string;
  password_text: string;
  label: string | null;
  created_at: string;
}

const App: React.FC = () => {
  // Generator State
  const [password, setPassword] = useState<string>('');
  const [length, setLength] = useState<number>(16);
  const [includeUppercase, setIncludeUppercase] = useState<boolean>(true);
  const [includeLowercase, setIncludeLowercase] = useState<boolean>(true);
  const [includeNumbers, setIncludeNumbers] = useState<boolean>(true);
  const [includeSymbols, setIncludeSymbols] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [strength, setStrength] = useState<string>('Weak');
  const [strengthColor, setStrengthColor] = useState<string>('bg-red-500');

  // Auth State
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // CRUD State
  const [savedPasswords, setSavedPasswords] = useState<SavedPassword[]>([]);
  const [loadingPasswords, setLoadingPasswords] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveLabel, setSaveLabel] = useState<string>('');
  const [showSavedPassword, setShowSavedPassword] = useState<Record<string, boolean>>({});


  // --- Authentication ---

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoadingAuth(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoadingAuth(false);
        // Clear auth form on state change
        setEmail('');
        setAuthPassword('');
        setAuthError(null);
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      let error;
      if (authMode === 'login') {
        ({ error } = await supabase.auth.signInWithPassword({ email, password: authPassword }));
      } else {
        ({ error } = await supabase.auth.signUp({
          email,
          password: authPassword,
          options: {
            // emailRedirectTo: window.location.origin // Optional: if email confirmation is enabled
          }
         }));
         // Optionally auto-login after sign up or show message
         if (!error) {
            alert('Signup successful! Please check your email if confirmation is required, otherwise you might be logged in automatically.');
            // Reset to login mode after successful signup attempt
            setAuthMode('login');
         }
      }
      if (error) throw error;
    } catch (error: any) {
      setAuthError(error.message || 'An unexpected error occurred.');
      console.error("Auth Error:", error);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setAuthLoading(true);
    await supabase.auth.signOut();
    setAuthLoading(false);
    setSavedPasswords([]); // Clear saved passwords on logout
  };


  // --- Password Generation ---

  const calculateStrength = useCallback(() => {
    let score = 0;
    if (length >= 8) score++;
    if (length >= 12) score++;
    if (length >= 16) score++;
    if (includeUppercase) score++;
    if (includeLowercase) score++;
    if (includeNumbers) score++;
    if (includeSymbols) score++;

    if (score <= 2) setStrength('Weak'), setStrengthColor('bg-red-500');
    else if (score <= 4) setStrength('Medium'), setStrengthColor('bg-yellow-500');
    else if (score <= 6) setStrength('Strong'), setStrengthColor('bg-orange-500');
    else setStrength('Very Strong'), setStrengthColor('bg-green-500');
  }, [length, includeUppercase, includeLowercase, includeNumbers, includeSymbols]);

  const generatePassword = useCallback(() => {
    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const numberChars = '0123456789';
    const symbolChars = '!@#$%^&*()_+~`|}{[]:;?><,./-=';

    let availableChars = '';
    if (includeUppercase) availableChars += uppercaseChars;
    if (includeLowercase) availableChars += lowercaseChars;
    if (includeNumbers) availableChars += numberChars;
    if (includeSymbols) availableChars += symbolChars;

    if (availableChars.length === 0) {
      setPassword('Select at least one character type');
      return;
    }

    let generated = '';
    const guaranteedChars: string[] = [];
    if (includeUppercase) guaranteedChars.push(uppercaseChars[Math.floor(Math.random() * uppercaseChars.length)]);
    if (includeLowercase) guaranteedChars.push(lowercaseChars[Math.floor(Math.random() * lowercaseChars.length)]);
    if (includeNumbers) guaranteedChars.push(numberChars[Math.floor(Math.random() * numberChars.length)]);
    if (includeSymbols) guaranteedChars.push(symbolChars[Math.floor(Math.random() * symbolChars.length)]);

    const remainingLength = Math.max(0, length - guaranteedChars.length); // Ensure non-negative
    const randomValues = new Uint32Array(remainingLength);
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < remainingLength; i++) {
      generated += availableChars[randomValues[i] % availableChars.length];
    }

    // Shuffle guaranteed characters into the generated string
    let combinedChars = (generated + guaranteedChars.join('')).split('');
    // Fisher-Yates (Knuth) Shuffle
    for (let i = combinedChars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combinedChars[i], combinedChars[j]] = [combinedChars[j], combinedChars[i]];
    }
    generated = combinedChars.join('');


    // Ensure final password is exactly the desired length
    setPassword(generated.slice(0, length));
    setCopied(false);
    setSaveError(null); // Clear save error on new generation
    setSaveLabel(''); // Clear label on new generation
  }, [length, includeUppercase, includeLowercase, includeNumbers, includeSymbols]);

  useEffect(() => {
    generatePassword(); // Generate initial password on load
  }, [generatePassword]); // Only run once on mount

  useEffect(() => {
    calculateStrength();
  }, [password, calculateStrength]);

  const copyToClipboard = useCallback(() => {
    if (password && password !== 'Select at least one character type') {
      navigator.clipboard.writeText(password).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [password]);

  const canGenerate = includeUppercase || includeLowercase || includeNumbers || includeSymbols;

  // --- CRUD Operations ---

  const fetchSavedPasswords = useCallback(async () => {
    if (!user) return;
    setLoadingPasswords(true);
    try {
      const { data, error } = await supabase
        .from('passwords')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedPasswords(data || []);
      // Reset show state for passwords
      const initialShowState: Record<string, boolean> = {};
      (data || []).forEach(p => initialShowState[p.id] = false);
      setShowSavedPassword(initialShowState);

    } catch (error: any) {
      console.error("Error fetching passwords:", error);
      setSaveError("Failed to load saved passwords."); // Use saveError state for simplicity
    } finally {
      setLoadingPasswords(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchSavedPasswords();
    } else {
      setSavedPasswords([]); // Clear passwords if user logs out
    }
  }, [user, fetchSavedPasswords]);

  const handleSavePassword = async () => {
    if (!user || !password || password === 'Select at least one character type') return;
    setAuthLoading(true); // Reuse auth loading state for simplicity
    setSaveError(null);
    try {
      const { error } = await supabase
        .from('passwords')
        .insert({
          user_id: user.id,
          password_text: password, // WARNING: Storing plain text passwords is NOT secure for real applications. Consider encryption.
          label: saveLabel || null,
        });
      if (error) throw error;
      setSaveLabel(''); // Clear label input
      await fetchSavedPasswords(); // Refresh list
    } catch (error: any) {
      console.error("Error saving password:", error);
      setSaveError("Failed to save password. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDeletePassword = async (id: string) => {
     if (!user || !window.confirm("Are you sure you want to delete this password?")) return;
     setAuthLoading(true); // Reuse loading state
     try {
        const { error } = await supabase
            .from('passwords')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id); // Ensure user owns the password (RLS also enforces this)

        if (error) throw error;
        // Optimistic UI update or refetch
        setSavedPasswords(prev => prev.filter(p => p.id !== id));
        // Remove from show state
        setShowSavedPassword(prev => {
            const newState = {...prev};
            delete newState[id];
            return newState;
        });

     } catch (error: any) {
        console.error("Error deleting password:", error);
        alert("Failed to delete password."); // Simple alert for error
     } finally {
        setAuthLoading(false);
     }
  };

   const toggleShowPassword = (id: string) => {
    setShowSavedPassword(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };


  // --- Render Logic ---

  if (loadingAuth) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500"><p className="text-white text-xl">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-6 md:p-8">

        {/* Auth Section */}
        {!session ? (
          <div className="mb-8">
            {/* Gebeya Logo Added Here - Updated URL */}
            <img
              src="https://gebeya.com/wp-content/uploads/2025/02/Gebeya_24_Logo_Primary_FullColorReversed-1.svg"
              alt="Gebeya Logo"
              className="h-10 w-auto mx-auto mb-6" // Adjusted margin
            />
            <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">{authMode === 'login' ? 'Login' : 'Sign Up'}</h2>
            <form onSubmit={handleAuth}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full p-3 mb-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <input
                type="password"
                placeholder="Password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                className="w-full p-3 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              {authError && <p className="text-red-500 text-sm mb-3">{authError}</p>}
              <button
                type="submit"
                disabled={authLoading}
                className={`w-full p-3 text-lg font-semibold text-white rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${authLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700'}`}
              >
                {authLoading ? 'Processing...' : (authMode === 'login' ? 'Login' : 'Sign Up')}
              </button>
            </form>
            <button
              onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(null); }}
              className="mt-4 text-center w-full text-sm text-orange-600 hover:underline"
            >
              {authMode === 'login' ? 'Need an account? Sign Up' : 'Already have an account? Login'}
            </button>
          </div>
        ) : (
          // Generator and Saved Passwords Section (Logged In)
          <>
            <div className="flex justify-between items-center mb-6">
              <p className="text-sm text-gray-600">Logged in as: <span className="font-medium">{user?.email}</span></p>
              <button
                onClick={handleLogout}
                disabled={authLoading}
                className="flex items-center px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors duration-200"
              >
                <LogOut size={16} className="mr-1" /> Logout
              </button>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-6">Password Generator</h1>

            {/* Password Display & Copy */}
            <div className="relative mb-1">
              <input
                type="text"
                value={password}
                readOnly
                className="w-full p-3 pr-24 text-lg bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 font-mono"
                placeholder="Your password"
              />
              <div className="absolute inset-y-0 right-0 flex items-center">
                 <button
                    onClick={copyToClipboard}
                    className={`h-full px-3 flex items-center transition-colors duration-200 ${
                    copied
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                    }`}
                    title={copied ? 'Copied!' : 'Copy to Clipboard'}
                 >
                    <Copy size={20} />
                 </button>
                 <button
                    onClick={generatePassword}
                    disabled={!canGenerate}
                    className={`h-full px-3 flex items-center rounded-r-md transition-colors duration-200 ${!canGenerate ? 'bg-gray-400 text-gray-600 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                    title="Generate New Password"
                 >
                    <RefreshCw size={20} />
                 </button>
              </div>
            </div>
            {copied && <p className="text-green-600 text-sm text-center mb-3 -mt-1">Copied to clipboard!</p>}

            {/* Save Password Section */}
            <div className="mt-4 mb-4 flex items-center space-x-2">
                <input
                    type="text"
                    placeholder="Optional Label (e.g., 'Gmail')"
                    value={saveLabel}
                    onChange={(e) => setSaveLabel(e.target.value)}
                    className="flex-grow p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
                />
                <button
                    onClick={handleSavePassword}
                    disabled={authLoading || !password || password === 'Select at least one character type'}
                    className={`flex items-center px-4 py-2 text-sm font-semibold text-white rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500 ${
                        (authLoading || !password || password === 'Select at least one character type')
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                    title="Save generated password"
                >
                    <Save size={16} className="mr-1" /> Save
                </button>
            </div>
             {saveError && <p className="text-red-500 text-sm text-center mb-3 -mt-2">{saveError}</p>}


            {/* Strength Indicator */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-600">Strength:</span>
                <span className={`text-sm font-semibold ${
                  strength === 'Weak' ? 'text-red-600' :
                  strength === 'Medium' ? 'text-yellow-600' :
                  strength === 'Strong' ? 'text-orange-600' : 'text-green-600'
                }`}>{strength}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className={`h-2.5 rounded-full transition-all duration-300 ${strengthColor}`} style={{ width: `${
                    strength === 'Weak' ? '25%' :
                    strength === 'Medium' ? '50%' :
                    strength === 'Strong' ? '75%' : '100%'
                  }` }}></div>
              </div>
            </div>

            {/* Length Slider */}
            <div className="mb-6">
              <label htmlFor="length" className="block text-sm font-medium text-gray-700 mb-2">
                Password Length: <span className="font-bold text-orange-600">{length}</span>
              </label>
              <input
                type="range"
                id="length"
                min="8"
                max="128"
                value={length}
                onChange={(e) => setLength(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-slider"
              />
            </div>

            {/* Character Type Checkboxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Checkbox items */}
              <div className="flex items-center">
                <input type="checkbox" id="uppercase" checked={includeUppercase} onChange={(e) => setIncludeUppercase(e.target.checked)} className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"/>
                <label htmlFor="uppercase" className="ml-2 block text-sm text-gray-900 cursor-pointer">Uppercase (A-Z)</label>
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="lowercase" checked={includeLowercase} onChange={(e) => setIncludeLowercase(e.target.checked)} className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"/>
                <label htmlFor="lowercase" className="ml-2 block text-sm text-gray-900 cursor-pointer">Lowercase (a-z)</label>
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="numbers" checked={includeNumbers} onChange={(e) => setIncludeNumbers(e.target.checked)} className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"/>
                <label htmlFor="numbers" className="ml-2 block text-sm text-gray-900 cursor-pointer">Numbers (0-9)</label>
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="symbols" checked={includeSymbols} onChange={(e) => setIncludeSymbols(e.target.checked)} className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"/>
                <label htmlFor="symbols" className="ml-2 block text-sm text-gray-900 cursor-pointer">Symbols (!@#...)</label>
              </div>
            </div>
             {!canGenerate && <p className="text-red-500 text-sm text-center mb-4 -mt-2">Please select at least one character type.</p>}


            {/* Saved Passwords List */}
            <div className="mt-8 pt-6 border-t border-gray-200">
                <h2 className="text-lg font-semibold text-gray-700 mb-4">Saved Passwords</h2>
                {loadingPasswords ? (
                    <p className="text-gray-500 text-center">Loading saved passwords...</p>
                ) : savedPasswords.length === 0 ? (
                    <p className="text-gray-500 text-center">No passwords saved yet.</p>
                ) : (
                    <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {savedPasswords.map((p) => (
                            <li key={p.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md shadow-sm">
                                <div className="flex-1 overflow-hidden mr-2">
                                    <span className="text-sm font-medium text-gray-800 block truncate" title={p.label || 'No Label'}>
                                        {p.label || <i className="text-gray-400">No Label</i>}
                                    </span>
                                    <span className="text-xs text-gray-500 font-mono block truncate" title={showSavedPassword[p.id] ? p.password_text : '••••••••'}>
                                        {showSavedPassword[p.id] ? p.password_text : '••••••••'}
                                    </span>
                                </div>
                                <div className="flex items-center space-x-2 flex-shrink-0">
                                     <button
                                        onClick={() => toggleShowPassword(p.id)}
                                        className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                                        title={showSavedPassword[p.id] ? "Hide Password" : "Show Password"}
                                    >
                                        {showSavedPassword[p.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(p.password_text)}
                                        className="p-1 text-gray-500 hover:text-green-600 transition-colors"
                                        title="Copy Password"
                                    >
                                        <Copy size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDeletePassword(p.id)}
                                        className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                                        title="Delete Password"
                                        disabled={authLoading}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default App;
