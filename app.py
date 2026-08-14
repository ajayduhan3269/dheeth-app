from openai import OpenAI

# Client setup (Base URL aur API Key bilkul sahi hain aapke)
client = OpenAI(
    base_url="https://api.featherless.ai/v1", 
    api_key="rc_230787e4bd4b2fd6cacff192d34bec18dd48f6a143c7036148fdd70ddced033b"
)

print("GLM 5.2 se response mang rahe hain...\n")

try:
    # Yahan humne exact model ID 'zai-org/GLM-5.2' daal di hai
    response = client.chat.completions.create(
        model="zai-org/GLM-5.2", 
        messages=[
            {"role": "user", "content": "Tell me a coding joke in Hindi."}
        ]
    )
    print("--- GLM 5.2 Ka Jawab ---")
    print(response.choices[0].message.content)

except Exception as e:
    print(f"Kuch error aaya: {e}")