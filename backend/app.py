import os
import google.generativeai as genai
import git
import shutil
import zipfile
import stat
import traceback
from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Helper function to remove read-only files during cleanup
def remove_readonly(func, path, excinfo):
    """
    Error handler for shutil.rmtree.

    If the error is for readonly file, it changes the permissions and retries.
    If the error is for another reason, it re-raises the error.
    """
    if not os.access(path, os.W_OK):
        # path is read-only, so change permissions and retry
        os.chmod(path, stat.S_IWUSR)
        func(path)
    else:
        raise


# Load environment variables from .env file
load_dotenv()

# Configure the Gemini API
try:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel('gemini-1.5-flash')
except AttributeError as e:
    print(f"Error: The GEMINI_API_KEY is not set. Please check your .env file. Details: {e}")
    exit()


app = Flask(__name__)
# NEW, PRODUCTION-READY LINE
CORS(app, resources={r"/api/*": {"origins": "*"}})

# --- HELPER FUNCTIONS ---

def analyze_project_structure(path):
    """Analyzes the code structure and returns a summary."""
    summary = "Project file structure:\n"
    code_snippets = "\nKey code snippets:\n"
    
    # Files to prioritize for snippets
    key_files = ['package.json', 'requirements.txt', 'index.html', 'main.py', 'app.py', 'server.js']

    for root, dirs, files in os.walk(path):
        # Ignore node_modules, .git, and other common folders
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '__pycache__', 'venv']]
        
        level = root.replace(path, '').count(os.sep)
        indent = ' ' * 4 * (level)
        summary += f"{indent}{os.path.basename(root)}/\n"
        sub_indent = ' ' * 4 * (level + 1)
        for f in files:
            summary += f"{sub_indent}{f}\n"
            if f in key_files:
                try:
                    with open(os.path.join(root, f), 'r', encoding='utf-8') as file_content:
                        content = file_content.read(1000) # Read first 1000 characters
                        code_snippets += f"\n--- Content of {f} ---\n{content}\n---------------------\n"
                except Exception:
                    code_snippets += f"\n--- Could not read content of {f} ---\n"
                    
    return summary + code_snippets

# --- API ENDPOINTS ---
# Add this somewhere near your other routes
@app.route('/')
def index():
    return "IntelliDocs AI backend is running!"

# ... rest of your app.py code

@app.route('/api/format-text', methods=['POST'])
def format_text():
    """Receives raw text and returns it formatted by the AI."""
    data = request.get_json()
    raw_text = data.get('text')

    if not raw_text:
        return jsonify({"error": "No text provided"}), 400

    try:
        prompt = f"""
        Please format the following text into a clean, well-structured document using Markdown. 
        Identify the main title, headings, subheadings, bullet points, and any other relevant structures.
        Ensure the output is only the formatted Markdown content.

        Raw Text:
        ---
        {raw_text}
        ---
        """
        response = model.generate_content(prompt)
        return jsonify({"formatted_text": response.text})
    except Exception as e:
        # This is the new, corrected part
        print("--- AN ERROR OCCURRED IN THE /api/format-text ROUTE ---")
        traceback.print_exc() # This prints the full error to the terminal
        print("----------------------------------------------------")
        return jsonify({"error": "An internal error occurred. Check the backend terminal for details."}), 500

@app.route('/api/generate-readme', methods=['POST'])
def generate_readme():
    """Generates a README from a GitHub URL, a zip file, or individual files."""
    repo_path = None # To ensure it's cleaned up

    try:
        if 'repo_url' in request.form and request.form['repo_url']:
            # ... (the code for handling repo_url remains the same) ...
            repo_url = request.form['repo_url']
            repo_path = os.path.join("temp_repos", os.path.basename(repo_url))
            if os.path.exists(repo_path):
                shutil.rmtree(repo_path, onerror=remove_readonly)
            git.Repo.clone_from(repo_url, repo_path)
            project_summary = analyze_project_structure(repo_path)

        elif 'zip_file' in request.files and request.files['zip_file'].filename != '':
            # ... (the code for handling zip_file remains the same) ...
            zip_file = request.files['zip_file']
            repo_path = os.path.join("temp_uploads", "project_zip")
            if os.path.exists(repo_path):
                shutil.rmtree(repo_path, onerror=remove_readonly)
            os.makedirs(repo_path)
            zip_path = os.path.join(repo_path, zip_file.filename)
            zip_file.save(zip_path)
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(repo_path)
            project_summary = analyze_project_structure(repo_path)

        elif 'files' in request.files:
            # ... (the code for handling multiple files remains the same) ...
            uploaded_files = request.files.getlist('files')
            if not uploaded_files or uploaded_files[0].filename == '':
                 return jsonify({"error": "No files were selected"}), 400
            repo_path = os.path.join("temp_uploads", "project_files")
            if os.path.exists(repo_path):
                shutil.rmtree(repo_path, onerror=remove_readonly)
            os.makedirs(repo_path)
            for file in uploaded_files:
                if file and file.filename:
                    filename = secure_filename(file.filename)
                    file.save(os.path.join(repo_path, filename))
            project_summary = analyze_project_structure(repo_path)
        
        else:
            return jsonify({"error": "No GitHub URL, zip file, or individual files provided"}), 400
        
        # --- THIS IS THE UPGRADED PROMPT WITH THE FLOW DIAGRAM ---
        prompt = f"""
        As an expert senior software developer and technical writer, create an exceptionally detailed and professional README.md file based on the following project analysis. The tone should be clear, comprehensive, and helpful to a new developer.

        **Structure the README with the following sections in this exact order:**

        1.  **Project Title:** A creative and descriptive title.
        2.  **Project Overview:** A detailed paragraph explaining the project's purpose, what problem it solves, and who the target user is.
        3.  **Key Features:** A bulleted list of the most important features.
        4.  **Tech Stack:** A table listing the languages, frameworks, major libraries and external APIs (if any) used.
        5.  **Workflow Diagram:** A detailed, text-based (ASCII) flow diagram illustrating the complete data and user flow of the application. The diagram should clearly show the simple path from the user's action on the React frontend, to the backend, to the external API if used any (also mention the name of API used if any), and back to the user.
        6.  **Project Structure:** A brief explanation of the key files and folder structure. Describe the purpose of important files.
        7.  **Setup and Installation:** A clear, step-by-step guide on how to get the project running locally. Include all necessary commands (e.g., `git clone`, `npm install`, `pip install`).
        8.  **Usage:** Explain how to run the application and use its main features after installation.
        9.  **Code Explanation:** (If applicable) Briefly explain the logic of one or two key functions or components from the provided code snippets.
        10. **API Endpoints:** (If it's a backend project) List and describe the API endpoints, including the HTTP method and what they do. Don't assume anything on your own. Don't make any assumptions.

        Here is the project analysis to use:
        ---
        {project_summary}
        ---

        Generate only the Markdown content for the README.md file. Do not include any introductory text like "Here is the README...".
        """
        # --- END OF UPGRADED PROMPT ---
        
        response = model.generate_content(prompt)
        return jsonify({"readme_content": response.text})

    except Exception as e:
        # ... (the exception handling remains the same) ...
        print("--- AN ERROR OCCURRED IN THE /api/generate-readme ROUTE ---")
        traceback.print_exc()
        print("---------------------------------------------------------")
        return jsonify({"error": str(e)}), 500
    finally:
        # ... (the cleanup logic remains the same) ...
        if repo_path and os.path.exists(repo_path):
            shutil.rmtree(repo_path, onerror=remove_readonly)

if __name__ == '__main__':
    # Ensure temp directories exist
    os.makedirs("temp_repos", exist_ok=True)
    os.makedirs("temp_uploads", exist_ok=True)
    app.run(debug=True, port=5001)