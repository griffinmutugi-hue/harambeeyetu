# Campaign payment details

- Generate each permanent Paybill reference from the campaign UUID in the database, and keep organizer payout phone numbers inaccessible to public and authenticated table reads; public queries must select only explicit safe columns. This prevents predictable references from diverging across clients and prevents organizer phone numbers from leaking through `SELECT *`.