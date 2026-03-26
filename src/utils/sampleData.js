export const SAMPLE_DBML = `Table users {
  id INT [pk, increment]
  name VARCHAR [not null]
  email VARCHAR [unique]
  created_at TIMESTAMP [default: \`now()\`]
  Note: 'stores user accounts'
}

Table posts {
  id INT [pk, increment]
  title VARCHAR [not null]
  body TEXT
  user_id INT [ref: > users.id]
}

Table tags {
  id INT [pk]
  name VARCHAR [unique]
}

Table post_tags {
  post_id INT [ref: > posts.id]
  tag_id INT [ref: > tags.id]
}

Ref: posts.user_id > users.id
Ref: post_tags.post_id > posts.id
Ref: post_tags.tag_id > tags.id
`;

export const DEFAULT_POSITIONS = {
  users: { x: 50, y: 50 },
  posts: { x: 450, y: 50 },
  tags: { x: 50, y: 450 },
  post_tags: { x: 450, y: 450 },
};
