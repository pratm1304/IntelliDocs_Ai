import React, { useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

// NEW, PRODUCTION-READY LINE
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

const App = () => {
    const [activeTab, setActiveTab] = useState('formatter');
    
    // State for Text Formatter
    const [rawText, setRawText] = useState('');
    const [formattedText, setFormattedText] = useState('');

    // State for README Generator
    const [repoUrl, setRepoUrl] = useState('');
    // --- CHANGE 1: Renamed state to handle multiple files ---
    const [uploadedFiles, setUploadedFiles] = useState(null); 
    const [readmeContent, setReadmeContent] = useState('');

    // Shared state
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFormatText = async () => {
        if (!rawText.trim()) {
            setError('Please enter some text to format.');
            return;
        }
        setIsLoading(true);
        setError('');
        setFormattedText('');
        try {
            const response = await axios.post(`${API_BASE_URL}/format-text`, { text: rawText });
            setFormattedText(response.data.formatted_text);
        } catch (err) {
            setError('An error occurred while formatting. Please try again.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateReadme = async () => {
        // --- CHANGE 2: Updated the check for files ---
        if (!repoUrl.trim() && !uploadedFiles) {
            setError('Please provide a GitHub URL or upload files.');
            return;
        }
        setIsLoading(true);
        setError('');
        setReadmeContent('');
        
        const formData = new FormData();
        if (repoUrl) formData.append('repo_url', repoUrl);
        
        // --- CHANGE 3: Loop through files and append them to FormData ---
        if (uploadedFiles) {
            for (let i = 0; i < uploadedFiles.length; i++) {
                formData.append('files', uploadedFiles[i]);
            }
        }

        try {
            const response = await axios.post(`${API_BASE_URL}/generate-readme`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setReadmeContent(response.data.readme_content);
        } catch (err) {
            setError('Failed to generate README. The repository might be private or invalid.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyToClipboard = (content) => {
        navigator.clipboard.writeText(content).then(() => {
            alert('Copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    };
    
    // ... (renderFormatter function remains the same) ...
     const renderFormatter = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Input Area */}
            <div>
                <label htmlFor="raw-text" className="block text-sm font-medium text-gray-300 mb-2">
                    Paste Your Unformatted Text Here
                </label>
                <textarea
                    id="raw-text"
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Type or paste your content..."
                    className="w-full h-80 p-4 bg-gray-800 border border-gray-600 rounded-md text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
                <button
                    onClick={handleFormatText}
                    disabled={isLoading}
                    className="mt-4 w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? 'Formatting...' : 'Format Text'}
                </button>
            </div>
            {/* Output Area */}
            <div>
                 <label className="block text-sm font-medium text-gray-300 mb-2">
                    Formatted Output
                </label>
                <div className="w-full h-80 p-4 bg-gray-900 border border-gray-600 rounded-md overflow-y-auto prose prose-invert max-w-none">
                    {formattedText ? (
                        <ReactMarkdown>{formattedText}</ReactMarkdown>
                    ) : (
                        <p className="text-gray-400">Your formatted text will appear here...</p>
                    )}
                </div>
                <button
                    onClick={() => handleCopyToClipboard(formattedText)}
                    disabled={!formattedText || isLoading}
                    className="mt-4 w-full bg-green-600 text-white font-bold py-3 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                >
                    Copy Formatted Text
                </button>
            </div>
        </div>
    );
    const renderReadmeGenerator = () => (
        <div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    <div className="md:col-span-2">
                         <label htmlFor="repo-url" className="block text-sm font-medium text-gray-300 mb-1">
                            Public GitHub Repository URL
                        </label>
                        <input
                            type="text"
                            id="repo-url"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            placeholder="https://github.com/user/repo"
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="text-center text-gray-400 font-semibold">OR</div>
                    <div className="md:col-span-2">
                         {/* --- CHANGE 4: Updated label --- */}
                        <label htmlFor="file-upload" className="block text-sm font-medium text-gray-300 mb-1">
                            Upload Project Files (html, css, etc.)
                        </label>
                        <input
                            type="file"
                            id="file-upload"
                            // --- CHANGE 5: Added 'multiple', removed 'accept', and updated handler ---
                            multiple
                            onChange={(e) => setUploadedFiles(e.target.files)}
                            className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
                        />
                    </div>
                </div>
                 <button
                    onClick={handleGenerateReadme}
                    disabled={isLoading}
                    className="mt-6 w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? 'Generating...' : 'Generate README'}
                </button>
            </div>

            <div className="mt-6">
                 <label className="block text-sm font-medium text-gray-300 mb-2">
                    Generated README.md
                </label>
                <div className="w-full min-h-[20rem] p-4 bg-gray-900 border border-gray-600 rounded-md overflow-y-auto prose prose-invert max-w-none">
                     {readmeContent ? (
                        <ReactMarkdown>{readmeContent}</ReactMarkdown>
                    ) : (
                        <p className="text-gray-400">Your generated README will appear here...</p>
                    )}
                </div>
                 <button
                    onClick={() => handleCopyToClipboard(readmeContent)}
                    disabled={!readmeContent || isLoading}
                    className="mt-4 w-full bg-green-600 text-white font-bold py-3 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                >
                    Copy README Content
                </button>
            </div>
        </div>
    );

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            <div className="container mx-auto p-4 md:p-8">
                <header className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
                        IntelliDocs AI
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Automated Content Formatting & Code Documentation
                    </p>
                </header>
                <div className="flex justify-center border-b border-gray-700 mb-6">
                    <button onClick={() => setActiveTab('formatter')} className={`py-3 px-6 font-semibold transition-colors ${activeTab === 'formatter' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'}`}>
                        ✍️ Smart Text Formatter
                    </button>
                    <button onClick={() => setActiveTab('readme')} className={`py-3 px-6 font-semibold transition-colors ${activeTab === 'readme' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'}`}>
                        👨‍💻 AI README Generator
                    </button>
                </div>
                {error && <div className="bg-red-500 text-white p-3 rounded-md mb-4 text-center">{error}</div>}
                <main>
                    {activeTab === 'formatter' ? renderFormatter() : renderReadmeGenerator()}
                </main>
            </div>
        </div>
    );
};

export default App;