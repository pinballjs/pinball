## Intro
Every message has a schema id. The schema id is always int32 and it has always tag 1.
Because the schema id is in the message, we need to use .pinball.PeekSchema to extract the schema id.
An alternative is to use a vint field before the message itself.

required int32 schema = 1 [default = 11];

## Reserved schema ids
1: ErrorEvent
