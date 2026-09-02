const aeonsEndData = {
  id: 'AE',
  name: 'Aeons End',
  type: 'standalone',
  nemeses: [
    {
      expansion: `Aeon's End (Core Set)`,
      name: 'Carapace Queen',
      id: 'CarapaceQueen',
      health: 60,
      difficulty: 3,
      expeditionRating: 1,
      additionalInfo: '',
    },
    {
      expansion: `Aeon's End (Core Set)`,
      name: 'Crooked Mask',
      id: 'CrookedMask',
      health: 70,
      difficulty: 5,
      expeditionRating: 2,
      additionalInfo: '',
    },
    {
      expansion: `Aeon's End (Core Set)`,
      name: 'Prince Of Gluttons',
      id: 'PrinceOfGluttons',
      health: 70,
      difficulty: 5,
      expeditionRating: 2,
      additionalInfo: '',
    },
    {
      expansion: `Aeon's End (Core Set)`,
      name: 'Rageborne',
      id: 'Rageborne',
      health: 70,
      difficulty: 2,
      expeditionRating: 1,
      additionalInfo: '',
    },
  ],
  mages: [
    {
      expansion: `Aeon's End (Core Set)`,
      name: 'Adelheim',
      recommendedCards: ['Diamond Cluster', 'Searing Ruby'],
      id: 'Adelheim',
      mageTitle: 'Breach Mage Weaponsmith',
      abilityName: 'Aethereal Ward',
      abilityActivation: 'Activate during the nemesis draw phase:',
      abilityEffect: `
        <p>When a nemesis attack or power card is drawn but before it is resolved, 
        you may discard it. It has no effect.
        <span class="hint">(The nemesis does not draw a replacement card)</span></p>
      `,
      numberOfCharges: 5,
      uniqueStarters: [
        {
          type: 'Gem',
          name: 'Amethyst Shard',
          expansion: `Aeon's End (Core Set)`,
          id: 'AmethystShard',
          cost: 0,
          effect: `
            <p>
              Gain 1 <span class="aether">&AElig;</span>.<br/>
              Any ally may draw a card and then discard a card in hand.
            </p>
          `,
          keywords: [],
        },
      ],
    },
    {
      expansion: `Aeon's End (Core Set)`,
      name: 'Brama',
      recommendedCards: ['Sifters Pearl', 'Bottled Vortex'],
      id: 'Brama',
      mageTitle: 'Breach Mage Elder',
      abilityName: 'Brink Siphon',
      abilityActivation: 'Activate during your main phase:',
      abilityEffect: `
        <p>Any player gains 4 life.</p>
      `,
      numberOfCharges: 5,
      uniqueStarters: [
        {
          type: 'Spell',
          name: 'Buried Light',
          expansion: `Aeon's End (Core Set)`,
          id: 'BuriedLight',
          cost: 0,
          effect: `
            <p>
              <b>Cast:</b> Deal 1 damage.<br/>
              Gain 1 <span class="aether">&AElig;</span>.
            </p>
          `,
          keywords: [],
        },
      ],
    },
    {
      expansion: `Aeon's End (Core Set)`,
      name: 'Jian',
      recommendedCards: ['Chaos Arc', 'Wildfire Whip', 'Lava Tendril'],
      id: 'Jian',
      mageTitle: 'Breach Mage Orphan',
      abilityName: 'Black Mirror',
      abilityActivation: 'Activate during your main phase',
      abilityEffect: `
        <p>Cast any player's prepped spell without discarding it.</p>
        <p>Then cast that prepped spell again.
        <span class="hint">(Discard it afterward.)</span></p>
      `,
      numberOfCharges: 4,
      uniqueStarters: [
        {
          type: 'Gem',
          name: 'Moonstone Shard',
          expansion: `Aeon's End (Core Set)`,
          id: 'MoonstoneShard',
          cost: 0,
          effect: `
            <p>
              Gain 1 <span class="aether">&AElig;</span>.<br/>
              Gain an additional 1 <span class="aether">&AElig;</span> that can 
              only be used to gain a gem.
            </p>
          `,
          keywords: [],
        },
      ],
    },
    {
      expansion: `Aeon's End (Core Set)`,
      name: 'Kadir',
      recommendedCards: ['Dark Fire', 'Feral Lightning'],
      id: 'Kadir',
      mageTitle: 'Breach Mage Delver',
      abilityName: 'Otherworldly Gate',
      abilityActivation: "Activate during any player's main phase:",
      abilityEffect: `
        <p>That player may return up to three spells in their discard pile 
        to their hand. That player may prep up to two spells to each 
        of their opened breaches this turn.</p>
      `,
      numberOfCharges: 5,
      uniqueStarters: [
        {
          type: 'Gem',
          name: 'Emerald Shard',
          expansion: `Aeon's End (Core Set)`,
          id: 'EmeraldShard',
          cost: 0,
          effect: `
            <p>
              Gain 1 <span class="aether">&AElig;</span>.
              <span class="or">OR</span>
              Any player gains 1 life.
            </p>
          `,
          keywords: [],
        },
      ],
    },
    {
      expansion: `Aeon's End (Core Set)`,
      name: 'Lash',
      recommendedCards: ['Clouded Sapphire', 'Focusing Orb'],
      id: 'Lash',
      mageTitle: 'Breach Mage Scout',
      abilityName: 'Quicken Thought',
      abilityActivation: "Activate during any player's main phase:",
      abilityEffect: `
        <p>Shuffle any player's turn order card into the turn order deck. 
        That player suffers 1 damage. <span class="hint">(You may not choose the 
        wildcard turn order card.)</span></p>
      `,
      numberOfCharges: 5,
      uniqueStarters: [
        {
          type: 'Gem',
          name: 'Quartz Shard',
          expansion: `Aeon's End (Core Set)`,
          id: 'QuartzShard',
          cost: 0,
          effect: `
            <p>
              Gain 1 <span class="aether">&AElig;</span>.<br/>
              Reveal the top card of the turn order deck. You may place that card 
              on the bottom or the top of the turn order deck. If you revealed 
              a player turn order card, gain an additional 1 <span class="aether">&AElig;</span>.
            </p>
          `,
          keywords: [],
        },
      ],
    },
    {
      expansion: `Aeon's End (Core Set)`,
      name: 'Mist',
      recommendedCards: ['Burning Opal', 'Amplify Vision'],
      id: 'Mist',
      mageTitle: 'Dagger Captain',
      abilityName: 'Divine Augury',
      abilityActivation: 'Activate during your main phase:',
      abilityEffect: `
        <p>Any ally draws 4 cards.</p>
      `,
      numberOfCharges: 5,
      uniqueStarters: [
        {
          type: 'Gem',
          name: 'Garnet Shard',
          expansion: `Aeon's End (Core Set)`,
          id: 'Garnet Shard',
          cost: 0,
          effect: `
            <p>
              Gain 1 <span class="aether">&AElig;</span>.
              <span class="or">OR</span>
              Cast any player's prepped spell.
            </p>
          `,
          keywords: [],
        },
      ],
    },
    {
      expansion: `Aeon's End (Core Set)`,
      name: 'Phaedraxa',
      recommendedCards: ['Consuming Void', 'Essence Theft'],
      id: 'Phaedraxa',
      mageTitle: 'Breach Mage Seer',
      abilityName: 'Auspex Rune',
      abilityActivation: 'Activate immediately after a turn order card is drawn:',
      abilityEffect: `
        <p>Prevent any damage that the players or Gravehold would suffer during that turn.</p>
      `,
      numberOfCharges: 5,
      uniqueStarters: [
        {
          type: 'Gem',
          name: 'Tourmaline Shard',
          expansion: `Aeon's End (Core Set)`,
          id: 'TourmalineShard',
          cost: 0,
          effect: `
            <p>
              Gain 1 <span class="aether">&AElig;</span>.<br/>
              Any ally may suffer 1 damage. If they do, they destroy a card in hand.
            </p>
          `,
          keywords: [],
        },
      ],
    },
    {
      expansion: `Aeon's End (Core Set)`,
      name: 'Xaxos',
      recommendedCards: ['Mages Talisman', 'Flexing Dagger'],
      id: 'Xaxos',
      mageTitle: 'Breach Mage Adept',
      abilityName: `Metaphysical Link`,
      abilityActivation: `Activate during any player's main phase:`,
      abilityEffect: `
        <p>Allies collectively gain 4 charges. Reveal the turn order deck and return 
        the revealed cards in any order.</p>
      `,
      numberOfCharges: 5,
      uniqueStarters: [
        {
          type: 'Spell',
          name: 'Flare',
          expansion: `Aeon's End (Core Set)`,
          id: 'Flare',
          cost: 0,
          effect: `
            <p>
              <b>Cast:</b> Reveal the top card of the turn order deck, 
              and then place it back on top of the turn order deck. If you 
              revealed a player turn order card, deal 3 damage. Otherwise, 
              deal 1 damage.
            </p>
          `,
          keywords: [],
        },
      ],
    },
  ],
  cards: [
    {
      type: 'Gem',
      expansion: `Aeon's End (Core Set)`,
      name: 'Diamond Cluster',
      id: 'DiamondCluster',
      cost: 4,
      effect: `
        <p>
          Gain 2 <span class="aether">&AElig;</span>.<br/>
          If this is the second time you have played Diamond Cluster this turn 
          gain an additional 2 <span class="aether">&AElig;</span>.
        </p>
      `,
      keywords: [],
    },
    {
      type: 'Spell',
      expansion: `Aeon's End (Core Set)`,
      name: 'Chaos Arc',
      id: 'ChaosArc',
      cost: 6,
      effect: `
      <p>
      <b>Cast:</b> Deal 3 damage.<br/>
      Deal 2 additional damage for each prepped spell in an adjacent breach.
        </p>
        `,
      keywords: [],
    },
    {
      type: 'Spell',
      expansion: `Aeon's End (Core Set)`,
      name: 'Ignite',
      id: 'Ignite',
      cost: 4,
      effect: `
        <p>
          <b>Cast:</b> Deal 2 damage.<br/>
          Any ally gains 1 charge.
        </p>
          `,
      keywords: [],
    },
    {
      type: 'Spell',
      expansion: `Aeon's End (Core Set)`,
      name: 'Essence Theft',
      id: 'EssenceTheft',
      cost: 5,
      effect: `
        <p>
          <b>Cast:</b> Deal 3 damage.<br/>
          You may discard a card in hand. If you do, any player gains 1 life.
        </p>
      `,
      keywords: [],
    },
    {
      type: 'Gem',
      expansion: `Aeon's End (Core Set)`,
      name: 'Searing Ruby',
      id: 'SearingRuby',
      cost: 4,
      effect: `
      <p>
      Gain 2 <span class="aether">&AElig;</span>.<br/>
      Gain an additional 1 <span class="aether">&AElig;</span> that can only 
      be used to gain a spell.
      </p>
      `,
      keywords: [],
    },
    {
      type: 'Spell',
      expansion: `Aeon's End (Core Set)`,
      name: 'Feral Lightning',
      id: 'FeralLightning',
      cost: 5,
      effect: `
        <p>
          This spell may be prepped to a closed breach without focusing it.<br/>
          <b>Cast:</b> Deal 3 damage.
        </p>
      `,
      keywords: [],
    },
    {
      type: 'Spell',
      expansion: `Aeon's End (Core Set)`,
      name: 'Planar Insight',
      id: 'PlanarInsight',
      cost: 6,
      effect: `
      <p>
      <b>Cast:</b> Deal 2 damage.<br/>
        Deal 1 addtional damage for each of your opened breaches.
        </p>
      `,
      keywords: [],
    },
    {
      type: 'Spell',
      expansion: `Aeon's End (Core Set)`,
      name: 'Spectral Echo',
      id: 'SpectralEcho',
      cost: 3,
      effect: `
        <p>
          <b>Cast:</b> Deal 2 damage.<br/>
          You may destroy a card in hand.
        </p>
          `,
      keywords: [],
    },
    {
      type: 'Gem',
      expansion: `Aeon's End (Core Set)`,
      name: 'Burning Opal',
      id: 'BurningOpal',
      cost: 5,
      effect: `
      <p>
      Gain 3 <span class="aether">&AElig;</span>.<br/>
      You may discard a card in hand. If you do, any ally draws a card.
      </p>
      `,
      keywords: [],
    },
    {
      type: 'Spell',
      expansion: `Aeon's End (Core Set)`,
      name: 'Consuming Void',
      id: 'ConsumingVoid',
      cost: 7,
      effect: `
      <p>
      <b>Cast:</b> Destroy up to two cards in hand.<br/>
      Deal 3 damage for each card destroyed in this way.
        </p>
        `,
      keywords: [],
    },
    {
      type: 'Relic',
      expansion: `Aeon's End (Core Set)`,
      name: 'Unstable Prism',
      id: 'UnstablePrism',
      cost: 3,
      effect: `
      <p>
        Play a gem in hand twice and destroy it.
        <span class="or">OR</span>
        Gain 2 <span class="aether">&AElig;</span>.
      </p>
        `,
      keywords: [],
    },
    {
      type: 'Gem',
      expansion: `Aeon's End (Core Set)`,
      name: 'Clouded Sapphire',
      id: 'CloudedSapphire',
      cost: 6,
      effect: `
      <p>
      Gain 3 <span class="aether">&AElig;</span>.<br/>
      If this is the first time you have played Clouded Sapphire this turn, 
      any ally gains 1 charge.
      </p>
      `,
      keywords: [],
    },
    {
      type: 'Relic',
      expansion: `Aeon's End (Core Set)`,
      name: 'Mages Talisman',
      id: 'MagesTalisman',
      cost: 5,
      effect: `
      <p>
        Gain 1 charge.<br/>
        Any ally gains 1 charge.
      </p>
        `,
      keywords: [],
    },
    {
      type: 'Relic',
      expansion: `Aeon's End (Core Set)`,
      name: 'Flexing Dagger',
      id: 'FlexingDagger',
      cost: 2,
      effect: `
      <p>
        The next time you focus or open a breach this turn, it costs 3 
        <span class="aether">&AElig;</span> less.
        <span class="or">OR</span>
        Destroy this. Deal 1 damage.
      </p>
        `,
      keywords: [],
    },
    {
      type: 'Spell',
      expansion: `Aeon's End (Core Set)`,
      name: 'Lava Tendril',
      id: 'LavaTendril',
      cost: 4,
      effect: `
      <p>
        While prepped, at the end of your casting phase deal 1 damage.<br/>
        <b>Cast:</b> Deal 3 damage.
        </p>
        `,
      keywords: [],
    },
    {
      type: 'Relic',
      expansion: `Aeon's End (Core Set)`,
      name: 'Bottled Vortex',
      id: 'BottledVortex',
      cost: 3,
      effect: `
      <p>
        Destroy this.<br/>
        Destroy up to two cards in your hand or discard pile.<br/>
        Draw a card.
      </p>
        `,
      keywords: [],
    },
    {
      type: 'Spell',
      expansion: `Aeon's End (Core Set)`,
      name: 'Arcane Nexus',
      id: 'ArcaneNexus',
      cost: 7,
      effect: `
      <p>
      While prepped, once per turn during your main phase you may return a gem 
      you played this turn to your hand.<br/>
        <b>Cast:</b> Deal 4 damage.
        </p>
      `,
      keywords: [],
    },
    {
      type: 'Spell',
      expansion: `Aeon's End (Core Set)`,
      name: 'Dark Fire',
      id: 'DarkFire',
      cost: 5,
      effect: `
        <p>
        <b>Cast:</b> Discard up to two cards in hand.<br/>
        Deal 3 damage for each card discarded this way.
        </p>
        `,
      keywords: [],
    },
    {
      type: 'Spell',
      expansion: `Aeon's End (Core Set)`,
      name: 'Phoenix Flame',
      id: 'PhoenixFlame',
      cost: 3,
      effect: `
        <p>
          <b>Cast:</b> Deal 2 damage.<br/>
          You may lose 1 charge to deal 2 additional damage.
        </p>
      `,
      keywords: [],
    },
    {
      type: 'Gem',
      expansion: `Aeon's End (Core Set)`,
      name: 'Jade',
      id: 'Jade',
      cost: 2,
      effect: `
      <p>
        Gain 2 <span class="aether">&AElig;</span>.
      </p>
        `,
      keywords: [],
    },
    {
      type: 'Spell',
      expansion: `Aeon's End (Core Set)`,
      name: 'Amplify Vision',
      id: 'AmplifyVision',
      cost: 4,
      effect: `
      <p>
      <b>Cast:</b> Focus your closed breach with the lowest focus cost.<br/>
      Deal 2 damage.<br/>
      If all of your breaches are opened, deal 1 additional damage.
        </p>
      `,
      keywords: [],
    },
    {
      type: 'Gem',
      expansion: `Aeon's End (Core Set)`,
      name: 'Vriswood Amber',
      id: 'VriswoodAmber',
      cost: 3,
      effect: `
      <p>
        When gain this, you may place it on top of your deck.<br/>
        Gain 2 <span class="aether">&AElig;</span>.
      </p>
        `,
      keywords: [],
    },
    {
      type: 'Relic',
      expansion: `Aeon's End (Core Set)`,
      name: 'Blasting Staff',
      id: 'BlastingStaff',
      cost: 4,
      effect: `
      <p>
        You may cast a prepped spell that you prepped this turn. If you do, 
        that spell deals 2 additional damage.
      </p>
        `,
      keywords: [],
    },
    {
      type: 'Gem',
      expansion: `Aeon's End (Core Set)`,
      name: 'Sifters Pearl',
      id: 'SiftersPearl',
      cost: 3,
      effect: `
      <p>
      Gain 2 <span class="aether">&AElig;</span>.<br/>
      Each player reveals the top card of their deck and either discards it or 
      returns it to the top of their deck.
      </p>
      `,
      keywords: [],
    },
    {
      type: 'Spell',
      expansion: `Aeon's End (Core Set)`,
      name: 'Wildfire Whip',
      id: 'WildfireWhip',
      cost: 6,
      effect: `
      <p>
      While prepped, during your main phase you may spend 2 <span class="aether">&AElig;</span> 
      to cast any player's prepped spell.<br/>
        <b>Cast:</b> Deal 4 damage.
        </p>
      `,
      keywords: [],
    },
    {
      type: 'Relic',
      expansion: `Aeon's End (Core Set)`,
      name: 'Focusing Orb',
      id: 'FocusingOrb',
      cost: 4,
      effect: `
      <p>
        Focus any player's breach.
        <span class="or">OR</span>
        Destroy this. Gravehold gains 3 life.
      </p>
        `,
      keywords: [],
    },
    {
      type: 'Spell',
      expansion: `Aeon's End (Core Set)`,
      name: 'Oblivion Swell',
      id: 'OblivionSwell',
      cost: 5,
      effect: `
      <p>
      While prepped, once per turn during your main phase you may gain 1 
      <span class="aether">&AElig;</span>.<br/>
      <b>Cast:</b> Deal 2 damage.<br/>
      You may discard a gem. If you do, deal additional damage equal to its cost.
        </p>
      `,
      keywords: [],
    },
  ],
}
export default aeonsEndData
