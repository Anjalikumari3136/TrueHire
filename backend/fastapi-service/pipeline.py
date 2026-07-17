import os
import httpx
from pydantic import BaseModel
from typing import List, Dict, Optional
from openai import OpenAI

# Initialize client (uses OPENAI_API_KEY environment variable)
client = OpenAI()

class ParsedProfile(BaseModel):
    target_role: str
    parsed_resume: str
    scraped_github_summary: str
    scraped_linkedin_summary: str
    current_cgpa: float

class ProfilePipeline:
    def __init__(self):
        # We use a standard HTTP client to hit public APIs
        self.http_client = httpx.AsyncClient(timeout=10.0)

    async def scrape_github_metrics(self, github_url: str) -> str:
        """
        Extracts public repository insights directly via the GitHub API.
        Bypasses heavy browser scraping for fast text synthesis.
        """
        if not github_url or "github.com/" not in github_url:
            return "No valid GitHub profile provided."
        
        try:
            # Extract username from the URL (e.g., https://github.com/octocat -> octocat)
            username = github_url.split("github.com/")[-1].strip("/").split("/")[0]
            api_url = f"https://api.github.com/users/{username}/repos?sort=updated&per_page=5"
            
            headers = {"User-Agent": "AI-Interview-System-Engine"}
            response = await self.http_client.get(api_url, headers=headers)
            
            if response.status_code != 200:
                return f"Could not retrieve public repositories for user: {username}"
            
            repos = response.json()
            repo_summary = []
            for repo in repos:
                name = repo.get("name", "N/A")
                desc = repo.get("description", "No description provided.")
                lang = repo.get("language", "Unknown")
                stars = repo.get("stargazers_count", 0)
                repo_summary.append(f"- Repo: {name} | Language: {lang} | Stars: {stars}\n  Desc: {desc}")
                
            return "\n".join(repo_summary) if repo_summary else "No public repositories found."
            
        except Exception as e:
            return f"Failed to extract GitHub metrics due to error: {str(e)}"

    async def summarize_resume_and_linkedin(self, raw_text: str, linkedin_raw: Optional[str] = None) -> Dict[str, str]:
        """
        Uses an LLM to take raw parsed PDF text and raw scraped LinkedIn text 
        and distill them down into concentrated summaries for the agent's context window.
        """
        system_instruction = (
            "You are a data ingestion agent. Your task is to extract core competencies, "
            "technical stack expertise, projects, and work history from the messy text provided. "
            "Convert it into a highly dense, structured paragraph summary."
        )
        
        user_content = f"--- RAW RESUME TEXT ---\n{raw_text}\n\n"
        if linkedin_raw:
            user_content += f"--- RAW LINKEDIN TEXT ---\n{linkedin_raw}"

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": user_content}
                ],
                temperature=0.2
            )
            summary = response.choices[0].message.content
            return {"resume_summary": summary, "linkedin_summary": "Synced with resume evaluation context."}
        except Exception as e:
            return {"resume_summary": "Failed to parse text input.", "linkedin_summary": str(e)}

    async def close(self):
        await self.http_client.aclose()