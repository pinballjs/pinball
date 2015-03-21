## Intro
PSON is a super efficient binary serialization format for JSON focused on minimal encoding size.

Don't use PSON.ProgressivePair because a pinball process can be restarted after the dictionary has
been made.

## Tip
Create a dictionary registry api like https://github.com/schema-repo/schema-repo

```
message Message {
  vint   dictionary_id = 0;
  binary pson;
}
```

dictionary 0 is the empty dictionary.
