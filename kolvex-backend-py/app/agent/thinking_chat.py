"""Preserve provider reasoning state through LangChain tool-call turns."""

from langchain_openai import ChatOpenAI


class ThinkingChatOpenAI(ChatOpenAI):
    """DeepSeek and Kimi require reasoning_content on assistant tool messages."""

    def _create_chat_result(self, response, generation_info=None):
        result = super()._create_chat_result(response, generation_info)
        data = response if isinstance(response, dict) else response.model_dump()
        for generation, choice in zip(result.generations, data.get("choices", [])):
            reasoning = choice.get("message", {}).get("reasoning_content")
            if reasoning is not None:
                generation.message.additional_kwargs["reasoning_content"] = reasoning
        return result

    def _convert_chunk_to_generation_chunk(self, chunk, default_chunk_class, base_generation_info):
        result = super()._convert_chunk_to_generation_chunk(
            chunk, default_chunk_class, base_generation_info
        )
        choices = chunk.get("choices", [])
        if result is not None and choices:
            reasoning = choices[0].get("delta", {}).get("reasoning_content")
            if reasoning is not None:
                result.message.additional_kwargs["reasoning_content"] = reasoning
        return result

    def _get_request_payload(self, input_, *, stop=None, **kwargs):
        payload = super()._get_request_payload(input_, stop=stop, **kwargs)
        messages = self._convert_input(input_).to_messages()
        for original, serialized in zip(messages, payload.get("messages", [])):
            if serialized.get("role") == "assistant":
                reasoning = original.additional_kwargs.get("reasoning_content")
                if reasoning is not None:
                    serialized["reasoning_content"] = reasoning
        return payload
