# memory/graph_db.py
# Manages a knowledge graph in Neo4j AuraDB.
# Stores entities (as labeled nodes) and relationships between them
# extracted from research sessions, enabling structured reasoning over
# accumulated knowledge across sessions.

import os
import logging
from datetime import datetime, timezone
from neo4j import GraphDatabase
from neo4j.exceptions import Neo4jError

logger = logging.getLogger(__name__)


class GraphMemory:
    """Manages entity and relationship storage in Neo4j AuraDB."""

    def __init__(self):
        uri = os.getenv("NEO4J_URI")
        username = os.getenv("NEO4J_USERNAME", "neo4j")
        password = os.getenv("NEO4J_PASSWORD")
        self.database = os.getenv("NEO4J_DATABASE", "neo4j")

        if not uri or not password:
            raise ValueError("NEO4J_URI and NEO4J_PASSWORD environment variables must be set.")

        self.driver = GraphDatabase.driver(uri, auth=(username, password))
        logger.info(f"Neo4j driver initialized (database: {self.database}).")

    # ------------------------------------------------------------------
    # Entity storage
    # ------------------------------------------------------------------

    # Entity storage
    # ------------------------------------------------------------------

    def store_entity(
        self,
        name: str,
        entity_type: str,
        description: str,
        session_id: str,
        user_id: str = None,
    ) -> None:
        """
        Create or merge an entity node in Neo4j.

        Uses dynamic labels so entity_type becomes the node label
        (e.g., :Concept, :Person, :Technology).

        Args:
            name: The canonical name of the entity.
            entity_type: Label for the node (Concept, Person, Technology, etc.).
            description: Human-readable description of the entity.
            session_id: The session this entity was extracted from.
            user_id: The user this entity belongs to.
        """
        # Sanitize label — Neo4j labels cannot contain spaces or special chars
        label = "".join(c for c in entity_type if c.isalnum() or c == "_") or "Entity"
        label = label.capitalize()

        query = (
            f"MERGE (e:{label} {{name: $name, user_id: $user_id}}) "
            "ON CREATE SET e.description = $description, "
            "              e.session_id  = $session_id, "
            "              e.created_at  = $created_at "
            "ON MATCH  SET e.description = $description, "
            "              e.session_id  = $session_id"
        )
        params = {
            "name": name,
            "description": description,
            "session_id": session_id,
            "user_id": user_id or "default",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            with self.driver.session(database=self.database) as session:
                session.run(query, params)
            logger.info(f"Stored entity [{label}]: {name} (user_id: {params['user_id']})")
        except Neo4jError as e:
            logger.error(f"Neo4j error storing entity '{name}': {e}")
        except Exception as e:
            logger.error(f"Unexpected error storing entity '{name}': {e}")

    # ------------------------------------------------------------------
    # Relationship storage
    # ------------------------------------------------------------------

    def store_relationship(
        self,
        source_name: str,
        relation: str,
        target_name: str,
        session_id: str,
        user_id: str = None,
    ) -> None:
        """
        Create or merge a relationship between two nodes.

        Both nodes must already exist (or will be created as generic Entity nodes).

        Args:
            source_name: Name property of the source node.
            relation: Relationship type (will be upper-cased and snake_cased).
            target_name: Name property of the target node.
            session_id: The session this relationship was extracted from.
            user_id: The user this relationship belongs to.
        """
        # Sanitize relationship type
        rel_type = relation.upper().replace(" ", "_").replace("-", "_")
        rel_type = "".join(c for c in rel_type if c.isalnum() or c == "_") or "RELATED_TO"

        query = (
            "MERGE (a {name: $source_name, user_id: $user_id}) "
            "MERGE (b {name: $target_name, user_id: $user_id}) "
            f"MERGE (a)-[r:{rel_type}]->(b) "
            "ON CREATE SET r.session_id = $session_id, r.user_id = $user_id, r.created_at = $created_at"
        )
        params = {
            "source_name": source_name,
            "target_name": target_name,
            "session_id": session_id,
            "user_id": user_id or "default",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            with self.driver.session(database=self.database) as session:
                session.run(query, params)
            logger.info(f"Stored relationship: {source_name} -[{rel_type}]-> {target_name} (user_id: {params['user_id']})")
        except Neo4jError as e:
            logger.error(f"Neo4j error storing relationship '{source_name}' -> '{target_name}': {e}")
        except Exception as e:
            logger.error(f"Unexpected error storing relationship: {e}")

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------

    def retrieve_related(self, topic: str, limit: int = 10, user_id: str = None) -> list[dict]:
        """
        Find nodes and their relationships related to the given topic string.

        Performs a case-insensitive substring match on node names.

        Args:
            topic: The topic string to search for.
            limit: Maximum number of result paths to return.
            user_id: The user_id to filter by.

        Returns:
            List of dicts describing matched nodes and their relationships.
        """
        query = (
            "MATCH (a)-[r]->(b) "
            "WHERE a.user_id = $user_id AND b.user_id = $user_id "
            "  AND (toLower(a.name) CONTAINS toLower($topic) "
            "   OR toLower(b.name) CONTAINS toLower($topic)) "
            "RETURN a.name AS source, type(r) AS relation, b.name AS target, "
            "       a.description AS source_desc, b.description AS target_desc "
            "LIMIT $limit"
        )
        try:
            with self.driver.session(database=self.database) as session:
                result = session.run(query, {"topic": topic, "limit": limit, "user_id": user_id or "default"})
                records = []
                for record in result:
                    records.append(
                        {
                            "source": record["source"],
                            "relation": record["relation"],
                            "target": record["target"],
                            "source_description": record["source_desc"],
                            "target_description": record["target_desc"],
                        }
                    )
            logger.info(f"Graph retrieval for '{topic}' returned {len(records)} records.")
            return records
        except Neo4jError as e:
            logger.error(f"Neo4j error retrieving related nodes for '{topic}': {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error during graph retrieval: {e}")
            return []

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def close(self) -> None:
        """Close the Neo4j driver connection."""
        try:
            self.driver.close()
            logger.info("Neo4j driver closed.")
        except Exception as e:
            logger.error(f"Error closing Neo4j driver: {e}")
