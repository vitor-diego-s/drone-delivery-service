import Drone from '../entities/Drone';
import DeliveryPackage from '../entities/Package';
import DeliveryLocation from '../entities/Location';
import { IDroneDelivery, ITripCollection } from '../shared/interfaces';

import { validatorDto } from '../shared/validatorDTO';
import { LocationsDTO, ILocation } from './LocationsDTO';
import { DroneSquadDTO, IDroneSquadMember } from './DronesDTO';

export default class DeliveryUseCase {
  constructor() {}

  async execute(droneSquadInfo: DroneSquadDTO, locationsInfo: LocationsDTO) {
    await validatorDto(LocationsDTO, locationsInfo);
    await validatorDto(DroneSquadDTO, droneSquadInfo);

    const { drones } = droneSquadInfo;
    const { locations } = locationsInfo;

    const droneSquad = drones.map(this.createSquadMember);
    const deliveryLocations = locations.map(this.createDeliveryLocation);

    return this.calculateTrips(droneSquad, deliveryLocations);
  }

  calculateTrips(
    droneSquad: Drone[],
    locations: DeliveryLocation[],
    mappedDeliveries: ITripCollection[] = []
  ): ITripCollection[] {
    const { deliveries, unallocated } = this.calculateDeliveries(
      droneSquad,
      locations
    );

    mappedDeliveries!.push({
      deliveries,
      tripId: Math.random().toString(),
      description: Math.random().toString(),
    });

    if (unallocated.length > 0) {
      return this.calculateTrips(droneSquad, unallocated, mappedDeliveries);
    }

    return mappedDeliveries!;
  }

  calculateDeliveries(droneSquad: Drone[], locations: DeliveryLocation[]) {
    let squadLocationsAsMap = new Map();
    let targetLocations: DeliveryLocation[] = [];

    const sortedDroneSquad = this.sortDronesByHighestWeight(droneSquad);
    const sortedLocations = this.sortLocationsByLowestWeight(locations);

    const deliveries: IDroneDelivery[] = sortedDroneSquad.map((drone) => {
      let remainingLocations =
        targetLocations.length > 0 ? targetLocations : sortedLocations;

      const { remaining, idleCapacity, targets } = this.matchLocationsByDrone(
        drone,
        remainingLocations,
        squadLocationsAsMap
      );

      targetLocations = this.sortLocationsByLowestWeight(remaining);

      return {
        drone,
        targets,
        idleCapacity,
      };
    });

    return {
      unallocated: targetLocations,
      deliveries: deliveries.filter((item) => item.targets.length > 0),
    };
  }

  matchLocationsByDrone(
    drone: Drone,
    sortedLocations: DeliveryLocation[],
    squadLocationsAsMap: Map<DeliveryLocation, string>
  ) {
    let idleCapacity = drone.getMaxWeight;

    sortedLocations.map((item, index, array) => {
      const nextItem = array[index + 1];

      const targetWeight = this.calculateTargetWeight(item, nextItem);
      const isAlreadyTagged = squadLocationsAsMap.has(item);

      if (!isAlreadyTagged && idleCapacity >= targetWeight) {
        if (nextItem) {
          squadLocationsAsMap.set(nextItem, drone.getId!);
        }

        squadLocationsAsMap.set(item, drone.getId!);
        idleCapacity -= targetWeight;
      }
    });

    const targets =
      idleCapacity < drone.getMaxWeight
        ? sortedLocations.filter((i) => squadLocationsAsMap.has(i))
        : [];

    return {
      targets,
      idleCapacity,
      remaining: sortedLocations.filter((i) => !squadLocationsAsMap.has(i)),
    };
  }

  sortLocationsByLowestWeight(locations: DeliveryLocation[]) {
    return locations.sort((a, b) => a.getPackages - b.getPackages);
  }

  sortDronesByHighestWeight(droneSquad: Drone[]) {
    return droneSquad.sort((a, b) => b.getMaxWeight - a.getMaxWeight);
  }

  calculateTargetWeight(location: DeliveryLocation, next?: DeliveryLocation) {
    return next
      ? location.getPackages + next?.getPackages
      : location.getPackages;
  }

  createSquadMember(member: IDroneSquadMember) {
    return new Drone(member.maxWeight, member.name);
  }

  createDeliveryLocation(deliveryLocation: ILocation) {
    const deliveryPackage = new DeliveryPackage(
      deliveryLocation.packagesWeight
    );

    return new DeliveryLocation(deliveryLocation.name, [deliveryPackage]);
  }
}
